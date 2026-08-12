import { offlineDb, OfflineRosterItem, OutboxEventItem, OfflineSessionItem, OfflineSessionRosterItem } from '../db/offlineDb';

// Utility to calculate SHA-256 hash consistently across Node and Browser environments
export async function computeSHA256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js fallback
    try {
      const cryptoNode = await import('crypto');
      return cryptoNode.createHash('sha256').update(text).digest('hex');
    } catch {
      // Fallback simple string hash if crypto unavailable
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(16);
    }
  }
}

// 1. Download & Store Offline Roster Package
export async function downloadAndStoreRosterPackage(schoolId: string, classSectionId: string) {
  const response = await fetch(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`);
  const json = await response.json();

  if (!json.success || !json.data) {
    throw new Error(json.error || 'FAILED_TO_DOWNLOAD_ROSTER');
  }

  const pkg = json.data;
  const studentItems: OfflineRosterItem[] = pkg.students.map((s: any) => ({
    studentId: s.studentId,
    schoolId,
    classSectionId,
    studentCode: s.studentCode,
    banglarShikshaId: s.banglarShikshaId,
    name: s.name,
    nameBn: s.nameBn,
    rollNumber: s.rollNumber,
    photoUrl: s.photoUrl,
    sha256TokenHash: s.sha256TokenHash,
    isRevoked: s.isRevoked,
  }));

  // Bulk put into Dexie IndexedDB
  await offlineDb.rosters.bulkPut(studentItems);
  return pkg;
}

// 2. Create Offline Session & Local Roster Snapshot
export async function createOfflineSession(params: {
  schoolId: string;
  classSectionId: string;
  teacherId: string;
  sessionDate: string;
  sessionType?: string;
  customSessionId?: string;
}): Promise<OfflineSessionItem> {
  const sessionId = params.customSessionId || `session_off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const session: OfflineSessionItem = {
    id: sessionId,
    schoolId: params.schoolId,
    classSectionId: params.classSectionId,
    sessionDate: params.sessionDate,
    sessionType: params.sessionType || 'DAILY',
    status: 'OPEN',
    teacherId: params.teacherId,
    isOfflineCreated: true,
  };

  await offlineDb.sessions.put(session);

  // Load students for this class section from offlineDb.rosters
  const rosterStudents = await offlineDb.rosters
    .where('[schoolId+classSectionId]')
    .equals([params.schoolId, params.classSectionId])
    .toArray();

  const sessionRosterItems: OfflineSessionRosterItem[] = rosterStudents.map((s) => ({
    sessionId,
    studentId: s.studentId,
    studentCode: s.studentCode,
    rollNumber: s.rollNumber,
    studentName: s.name,
    studentNameBn: s.nameBn,
    photoUrl: s.photoUrl,
    status: 'UNMARKED',
  }));

  if (sessionRosterItems.length > 0) {
    await offlineDb.sessionRosters.bulkPut(sessionRosterItems);
  }

  return session;
}

// 3. Process QR Code Offline
export async function processOfflineQRCode(params: {
  schoolId: string;
  sessionId: string;
  rawToken: string;
  actorId: string;
  clientTimestamp?: string;
  source?: 'CAMERA' | 'USB';
}) {
  const { schoolId, sessionId, rawToken, actorId, clientTimestamp, source = 'CAMERA' } = params;

  // Compute SHA-256 digest of raw token
  const tokenHash = await computeSHA256(rawToken);

  // Match student in offlineDb.rosters by sha256TokenHash
  const student = await offlineDb.rosters.where('sha256TokenHash').equals(tokenHash).first();

  if (!student) {
    return {
      success: false,
      error: 'INVALID_QR_TOKEN',
      message: 'Invalid or unrecognized QR credential',
    };
  }

  if (student.isRevoked) {
    return {
      success: false,
      error: 'REVOKED_QR_TOKEN',
      message: 'Revoked QR Credential',
      student,
    };
  }

  if (student.schoolId !== schoolId) {
    return {
      success: false,
      error: 'WRONG_SCHOOL_QR',
      message: 'QR code belongs to another school',
    };
  }

  // Check if student belongs to session roster snapshot
  const sessionRosterItem = await offlineDb.sessionRosters
    .where('[sessionId+studentId]')
    .equals([sessionId, student.studentId])
    .first();

  if (!sessionRosterItem) {
    return {
      success: false,
      error: 'STUDENT_NOT_IN_ROSTER',
      message: 'Student is not in this class section roster',
      student,
    };
  }

  // Check for duplicate scan
  if (sessionRosterItem.status === 'PRESENT') {
    return {
      success: true,
      duplicateScan: true,
      message: `Student ${student.name} already marked PRESENT`,
      student,
      record: {
        studentId: student.studentId,
        studentName: student.name,
        rollNumber: student.rollNumber,
        status: 'PRESENT',
      },
    };
  }

  const timestamp = clientTimestamp || new Date().toISOString();
  const clientEventId = `evt_off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Update session roster status locally in Dexie
  if (sessionRosterItem.id) {
    await offlineDb.sessionRosters.update(sessionRosterItem.id, {
      status: 'PRESENT',
      firstScannedAt: timestamp,
    });
  }

  // Add event to Outbox Queue in Dexie
  const outboxEvent: OutboxEventItem = {
    clientEventId,
    schoolId,
    sessionId,
    studentId: student.studentId,
    eventType: 'QR_SCANNED',
    statusValue: 'PRESENT',
    rawToken,
    clientTimestamp: timestamp,
    source,
    syncStatus: 'PENDING',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  await offlineDb.syncOutbox.put(outboxEvent);

  return {
    success: true,
    duplicateScan: false,
    eventId: clientEventId,
    student,
    record: {
      studentId: student.studentId,
      studentName: student.name,
      rollNumber: student.rollNumber,
      status: 'PRESENT',
      firstScannedAt: timestamp,
    },
  };
}

// 4. Flush Outbox Events to Server Batch Sync Endpoint
export async function syncOutboxEvents(params: {
  schoolId: string;
  deviceIdentifier?: string;
  customFetch?: typeof fetch;
}) {
  const { schoolId, deviceIdentifier, customFetch } = params;
  const fetchImpl = customFetch || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!fetchImpl) {
    throw new Error('FETCH_UNAVAILABLE');
  }

  // Fetch pending or failed outbox events
  const pendingEvents = await offlineDb.syncOutbox
    .where('syncStatus')
    .equals('PENDING')
    .toArray();

  const failedEvents = await offlineDb.syncOutbox
    .where('syncStatus')
    .equals('FAILED')
    .toArray();

  const eventsToSync = [...pendingEvents, ...failedEvents];

  if (eventsToSync.length === 0) {
    return { processedCount: 0, syncedCount: 0, failedCount: 0, results: [] };
  }

  // Mark status as SYNCING
  for (const ev of eventsToSync) {
    await offlineDb.syncOutbox.update(ev.clientEventId, { syncStatus: 'SYNCING' });
  }

  const payload = {
    deviceIdentifier,
    events: eventsToSync.map((e) => ({
      clientEventId: e.clientEventId,
      sessionId: e.sessionId,
      studentId: e.studentId,
      rawToken: e.rawToken,
      eventType: e.eventType,
      statusValue: e.statusValue,
      clientTimestamp: e.clientTimestamp,
      source: e.source,
    })),
  };

  try {
    const response = await fetchImpl(`/api/v1/schools/${schoolId}/sync/attendance-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 403) {
      const errJson = await response.json().catch(() => ({}));
      // Mark as FAILED due to device/user revocation
      for (const ev of eventsToSync) {
        await offlineDb.syncOutbox.update(ev.clientEventId, {
          syncStatus: 'FAILED',
          syncError: errJson.error || 'DEVICE_REVOKED',
        });
      }
      throw new Error(errJson.error || 'DEVICE_REVOKED');
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      throw new Error(json.error || 'SYNC_FAILED');
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const resItem of json.data.results) {
      if (resItem.status === 'ACCEPTED' || resItem.status === 'ALREADY_PROCESSED') {
        await offlineDb.syncOutbox.update(resItem.clientEventId, {
          syncStatus: 'SYNCED',
        });
        syncedCount++;
      } else {
        await offlineDb.syncOutbox.update(resItem.clientEventId, {
          syncStatus: 'FAILED',
          syncError: resItem.error || 'SERVER_REJECTED',
          retryCount: (eventsToSync.find((e) => e.clientEventId === resItem.clientEventId)?.retryCount || 0) + 1,
        });
        failedCount++;
      }
    }

    return {
      processedCount: eventsToSync.length,
      syncedCount,
      failedCount,
      results: json.data.results,
    };
  } catch (err: any) {
    // Revert status to FAILED for retry
    for (const ev of eventsToSync) {
      await offlineDb.syncOutbox.update(ev.clientEventId, {
        syncStatus: 'FAILED',
        syncError: err.message || 'NETWORK_ERROR',
        retryCount: ev.retryCount + 1,
      });
    }
    throw err;
  }
}

// 5. Get Pending Outbox Count
export async function getOutboxStatus() {
  const pendingCount = await offlineDb.syncOutbox.where('syncStatus').equals('PENDING').count();
  const failedCount = await offlineDb.syncOutbox.where('syncStatus').equals('FAILED').count();
  const syncingCount = await offlineDb.syncOutbox.where('syncStatus').equals('SYNCING').count();
  const syncedCount = await offlineDb.syncOutbox.where('syncStatus').equals('SYNCED').count();

  return {
    pendingCount,
    failedCount,
    syncingCount,
    syncedCount,
    unsyncedTotal: pendingCount + failedCount + syncingCount,
  };
}
