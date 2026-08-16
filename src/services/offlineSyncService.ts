import { offlineDb, OfflineRosterItem, OutboxEventItem, OfflineSessionItem, OfflineSessionRosterItem } from '../db/offlineDb';

function createClientUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error('SECURE_UUID_UNAVAILABLE');
}

// Utility to calculate SHA-256 hash consistently across Node and Browser environments
export async function computeSHA256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    try {
      const cryptoNode = await import('crypto');
      return cryptoNode.createHash('sha256').update(text).digest('hex');
    } catch {
      throw new Error('CRYPTO_SHA256_UNAVAILABLE: Secure SHA-256 crypto is required');
    }
  }
}

// 1. Download & Store Offline Roster Package
export async function downloadAndStoreRosterPackage(schoolId: string, classSectionId: string, deviceIdentifier: string) {
  if (!deviceIdentifier) throw new Error('DEVICE_IDENTIFIER_REQUIRED');
  const response = await fetch(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, {
    headers: { 'x-device-identifier': deviceIdentifier },
    credentials: 'include',
  });
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
  const sessionId = params.customSessionId || createClientUuid();

  const session: OfflineSessionItem = {
    id: sessionId,
    clientSessionId: sessionId,
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

  let session = await offlineDb.sessions.get(sessionId);
  if (!session) {
    session = await offlineDb.sessions.where('serverSessionId').equals(sessionId).first();
  }
  if (!session || session.schoolId !== schoolId) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND_OFFLINE',
      message: 'This attendance session is not available on this device',
    };
  }

  const effectiveLocalSessionId = session.id;

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
  let sessionRosterItem = await offlineDb.sessionRosters
    .where('[sessionId+studentId]')
    .equals([effectiveLocalSessionId, student.studentId])
    .first();

  if (!sessionRosterItem && sessionId !== effectiveLocalSessionId) {
    sessionRosterItem = await offlineDb.sessionRosters
      .where('[sessionId+studentId]')
      .equals([sessionId, student.studentId])
      .first();
  }

  if (!sessionRosterItem && student.classSectionId === session.classSectionId) {
    const newId = await offlineDb.sessionRosters.put({
      sessionId: effectiveLocalSessionId,
      studentId: student.studentId,
      studentCode: student.studentCode,
      studentName: student.name,
      studentNameBn: student.nameBn,
      rollNumber: student.rollNumber,
      status: 'UNMARKED',
    });
    sessionRosterItem = await offlineDb.sessionRosters.get(newId);
  }

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
    const scanTimeStr = sessionRosterItem.firstScannedAt
      ? new Date(sessionRosterItem.firstScannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';
    return {
      success: true,
      duplicateScan: true,
      message: scanTimeStr
        ? `${student.name} (Roll #${student.rollNumber}) already marked PRESENT at ${scanTimeStr}`
        : `${student.name} (Roll #${student.rollNumber}) already marked PRESENT`,
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
  const clientEventId = createClientUuid();

  // Add event to Outbox Queue and update session roster status atomically in Dexie
  const outboxEvent: OutboxEventItem = {
    clientEventId,
    schoolId,
    sessionId,
    sessionMetadata: {
      clientSessionId: session.clientSessionId,
      classSectionId: session.classSectionId,
      sessionDate: session.sessionDate,
      sessionType: session.sessionType,
    },
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

  await offlineDb.transaction('rw', [offlineDb.sessionRosters, offlineDb.syncOutbox], async () => {
    if (sessionRosterItem.id) {
      await offlineDb.sessionRosters.update(sessionRosterItem.id, {
        status: 'PRESENT',
        firstScannedAt: timestamp,
      });
    }
    await offlineDb.syncOutbox.put(outboxEvent);
  });

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

export async function clearSchoolScopedOfflineData(schoolId: string) {
  const sessions = await offlineDb.sessions.where('schoolId').equals(schoolId).toArray();
  const sessionIds = new Set(sessions.map((session) => session.id));
  await offlineDb.transaction('rw', [offlineDb.rosters, offlineDb.sessions, offlineDb.sessionRosters, offlineDb.syncOutbox], async () => {
    await offlineDb.rosters.where('schoolId').equals(schoolId).delete();
    await offlineDb.sessions.where('schoolId').equals(schoolId).delete();
    await offlineDb.syncOutbox.where('schoolId').equals(schoolId).delete();
    const localRoster = await offlineDb.sessionRosters.toArray();
    await offlineDb.sessionRosters.bulkDelete(localRoster.filter((item) => sessionIds.has(item.sessionId)).map((item) => item.id!).filter(Boolean));
  });
}

const MAX_SYNC_RETRIES = 5;
const SYNC_BATCH_SIZE = 75;

function classifySyncFailure(error: string): 'RETRYABLE' | 'PERMANENT' | 'CONFLICT' {
  if (error === 'FINALIZED_SESSION_LOCKED' || error.includes('CONFLICT')) return 'CONFLICT';
  if (['INVALID_QR_TOKEN', 'REVOKED_QR_TOKEN', 'WRONG_SCHOOL_QR', 'STUDENT_NOT_IN_ROSTER', 'SESSION_NOT_FOUND', 'DEVICE_REVOKED', 'DEVICE_IDENTIFIER_REQUIRED', 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED'].includes(error)) return 'PERMANENT';
  return 'RETRYABLE';
}

async function markSyncFailure(event: OutboxEventItem, error: string, failureClass: 'RETRYABLE' | 'PERMANENT' | 'CONFLICT') {
  const retryCount = event.retryCount + 1;
  const exhausted = failureClass === 'RETRYABLE' && retryCount >= MAX_SYNC_RETRIES;
  await offlineDb.syncOutbox.update(event.clientEventId, {
    syncStatus: failureClass === 'CONFLICT' ? 'CONFLICT' : (failureClass === 'PERMANENT' || exhausted ? 'PERMANENT_FAILURE' : 'FAILED'),
    failureClass: exhausted ? 'PERMANENT' : failureClass,
    syncError: error,
    retryCount,
  });
}

function getCsrfHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.match(/(?:^|; )(?:XSRF-TOKEN|csrfToken)=([^;]*)/i);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { 'x-csrf-token': token } : {};
}

// 4. Flush the outbox to the server in bounded batches.
export async function syncOutboxEvents(params: {
  schoolId: string;
  deviceIdentifier: string;
  customFetch?: typeof fetch;
}) {
  const { schoolId, deviceIdentifier, customFetch } = params;
  if (!deviceIdentifier) throw new Error('DEVICE_IDENTIFIER_REQUIRED');
  const fetchImpl = customFetch || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!fetchImpl) {
    throw new Error('FETCH_UNAVAILABLE');
  }

  // A browser crash or tab close can leave a batch marked SYNCING. Requeue it
  // before selecting work so those events cannot become permanently invisible.
  await offlineDb.syncOutbox.where('syncStatus').equals('SYNCING').modify({
    syncStatus: 'FAILED',
    failureClass: 'RETRYABLE',
    syncError: 'SYNC_INTERRUPTED',
  });

  // Fetch pending or failed outbox events
  const pendingEvents = await offlineDb.syncOutbox
    .where('syncStatus')
    .equals('PENDING')
    .toArray();

  const failedEvents = await offlineDb.syncOutbox
    .where('syncStatus')
    .equals('FAILED')
    .toArray();

  const eventsToSync = [...pendingEvents, ...failedEvents].filter((event) => event.retryCount < MAX_SYNC_RETRIES && event.failureClass !== 'PERMANENT' && event.failureClass !== 'CONFLICT');

  if (eventsToSync.length === 0) {
    return { processedCount: 0, syncedCount: 0, failedCount: 0, results: [], sessionMappings: [] };
  }

  const effectiveSchoolId = schoolId || eventsToSync[0]?.schoolId;
  if (!effectiveSchoolId) {
    throw new Error('SCHOOL_ID_REQUIRED');
  }

  const allResults: any[] = [];
  const allMappings: any[] = [];
  let syncedCount = 0;
  let failedCount = 0;
  let lastError: Error | null = null;

  for (let offset = 0; offset < eventsToSync.length; offset += SYNC_BATCH_SIZE) {
    const batch = eventsToSync.slice(offset, offset + SYNC_BATCH_SIZE);
    await Promise.all(batch.map((event) => offlineDb.syncOutbox.update(event.clientEventId, { syncStatus: 'SYNCING' })));
    const payload = {
      deviceIdentifier,
      sessions: Array.from(new Map(batch.map((event) => [event.sessionMetadata.clientSessionId, event.sessionMetadata])).values()),
      events: batch.map((event) => ({
        clientEventId: event.clientEventId,
        sessionId: event.sessionId,
        clientSessionId: event.sessionMetadata.clientSessionId,
        studentId: event.studentId,
        rawToken: event.rawToken,
        eventType: event.eventType,
        statusValue: event.statusValue,
        clientTimestamp: event.clientTimestamp,
        source: event.source,
        metadata: event.sessionMetadata,
      })),
    };

    try {
      const response = await fetchImpl(`/api/v1/schools/${effectiveSchoolId}/sync/attendance-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeader(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success || !json.data) throw new Error(json.error || 'SYNC_FAILED');

      for (const result of json.data.results || []) {
        const event = batch.find((candidate) => candidate.clientEventId === result.clientEventId);
        if (!event) continue;
        if (result.status === 'ACCEPTED' || result.status === 'ALREADY_PROCESSED') {
          const cleaned = { ...event, syncStatus: 'SYNCED' as const, syncError: undefined, failureClass: undefined };
          delete cleaned.rawToken;
          await offlineDb.syncOutbox.put(cleaned);
          syncedCount++;
        } else {
          const error = result.error || 'SERVER_REJECTED';
          await markSyncFailure(event, error, classifySyncFailure(error));
          failedCount++;
        }
      }
      for (const mapping of json.data.sessionMappings || []) {
        await offlineDb.sessions.update(mapping.clientSessionId, { serverSessionId: mapping.serverSessionId });
        allMappings.push(mapping);
      }
      allResults.push(...(json.data.results || []));
    } catch (err: any) {
      lastError = new Error(err.message || 'NETWORK_ERROR');
      await Promise.all(batch.map((event) => markSyncFailure(event, lastError!.message, 'RETRYABLE')));
      failedCount += batch.length;
    }
  }

  if (lastError && syncedCount === 0 && allResults.length === 0) throw lastError;
  return { processedCount: eventsToSync.length, syncedCount, failedCount, results: allResults, sessionMappings: allMappings };
}

// 5. Get Pending Outbox Count
export async function getOutboxStatus() {
  const pendingCount = await offlineDb.syncOutbox.where('syncStatus').equals('PENDING').count();
  const failedCount = await offlineDb.syncOutbox.where('syncStatus').equals('FAILED').count();
  const syncingCount = await offlineDb.syncOutbox.where('syncStatus').equals('SYNCING').count();
  const syncedCount = await offlineDb.syncOutbox.where('syncStatus').equals('SYNCED').count();
  const permanentFailureCount = await offlineDb.syncOutbox.where('syncStatus').equals('PERMANENT_FAILURE').count();
  const conflictCount = await offlineDb.syncOutbox.where('syncStatus').equals('CONFLICT').count();
  return {
    pendingCount,
    failedCount,
    syncingCount,
    syncedCount,
    permanentFailureCount,
    conflictCount,
    unsyncedTotal: pendingCount + failedCount + syncingCount + permanentFailureCount + conflictCount,
  };
}

export async function clearOfflineStore() {
  await offlineDb.transaction('rw', [offlineDb.rosters, offlineDb.sessions, offlineDb.sessionRosters, offlineDb.syncOutbox], async () => {
    await offlineDb.rosters.clear();
    await offlineDb.sessions.clear();
    await offlineDb.sessionRosters.clear();
    await offlineDb.syncOutbox.clear();
  });
}
