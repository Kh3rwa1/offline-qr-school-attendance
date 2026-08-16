import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { offlineDb } from '../src/db/offlineDb';
import { syncOutboxEvents, getOutboxStatus } from '../src/services/offlineSyncService';

describe('Strict Cross-School Multi-Tenant Offline Outbox Isolation', () => {
  beforeEach(async () => {
    await offlineDb.syncOutbox.clear();
  });

  it('proves records from School A are never counted or reported when School B is active', async () => {
    const now = new Date().toISOString();
    // 1. Insert outbox events for School A
    await offlineDb.syncOutbox.bulkPut([
      {
        clientEventId: 'evt-school-a-1',
        sessionId: 'sess-a-1',
        schoolId: 'school-a',
        studentId: 'stud-a-1',
        eventType: 'ATTENDANCE_SCAN',
        statusValue: 'PRESENT',
        clientTimestamp: now,
        createdAt: now,
        source: 'CAMERA',
        retryCount: 0,
        syncStatus: 'PENDING',
        sessionMetadata: {
          clientSessionId: 'sess-a-1',
          classSectionId: 'cls-a-1',
          sessionDate: '2026-08-16',
          sessionType: 'STANDARD',
        },
      },
      {
        clientEventId: 'evt-school-a-2',
        sessionId: 'sess-a-1',
        schoolId: 'school-a',
        studentId: 'stud-a-2',
        eventType: 'ATTENDANCE_SCAN',
        statusValue: 'PRESENT',
        clientTimestamp: now,
        createdAt: now,
        source: 'CAMERA',
        retryCount: 0,
        syncStatus: 'PENDING',
        sessionMetadata: {
          clientSessionId: 'sess-a-1',
          classSectionId: 'cls-a-1',
          sessionDate: '2026-08-16',
          sessionType: 'STANDARD',
        },
      },
    ]);

    // 2. Insert outbox event for School B
    await offlineDb.syncOutbox.put({
      clientEventId: 'evt-school-b-1',
      sessionId: 'sess-b-1',
      schoolId: 'school-b',
      studentId: 'stud-b-1',
      eventType: 'ATTENDANCE_SCAN',
      statusValue: 'PRESENT',
      clientTimestamp: now,
      createdAt: now,
      source: 'CAMERA',
      retryCount: 0,
      syncStatus: 'PENDING',
      sessionMetadata: {
        clientSessionId: 'sess-b-1',
        classSectionId: 'cls-b-1',
        sessionDate: '2026-08-16',
        sessionType: 'STANDARD',
      },
    });

    // 3. Verify getOutboxStatus strictly partitions by schoolId
    const statusSchoolA = await getOutboxStatus('school-a');
    expect(statusSchoolA.pendingCount).toBe(2);
    expect(statusSchoolA.unsyncedTotal).toBe(2);

    const statusSchoolB = await getOutboxStatus('school-b');
    expect(statusSchoolB.pendingCount).toBe(1);
    expect(statusSchoolB.unsyncedTotal).toBe(1);

    const statusAll = await getOutboxStatus();
    expect(statusAll.pendingCount).toBe(3);
    expect(statusAll.unsyncedTotal).toBe(3);
  });

  it('proves syncOutboxEvents for School B never transmits School A records', async () => {
    const now = new Date().toISOString();
    // 1. Insert outbox events for School A and School B
    await offlineDb.syncOutbox.bulkPut([
      {
        clientEventId: 'evt-school-a-1',
        sessionId: 'sess-a-1',
        schoolId: 'school-a',
        studentId: 'stud-a-1',
        eventType: 'ATTENDANCE_SCAN',
        statusValue: 'PRESENT',
        clientTimestamp: now,
        createdAt: now,
        source: 'CAMERA',
        retryCount: 0,
        syncStatus: 'PENDING',
        sessionMetadata: {
          clientSessionId: 'sess-a-1',
          classSectionId: 'cls-a-1',
          sessionDate: '2026-08-16',
          sessionType: 'STANDARD',
        },
      },
      {
        clientEventId: 'evt-school-b-1',
        sessionId: 'sess-b-1',
        schoolId: 'school-b',
        studentId: 'stud-b-1',
        eventType: 'ATTENDANCE_SCAN',
        statusValue: 'PRESENT',
        clientTimestamp: now,
        createdAt: now,
        source: 'CAMERA',
        retryCount: 0,
        syncStatus: 'PENDING',
        sessionMetadata: {
          clientSessionId: 'sess-b-1',
          classSectionId: 'cls-b-1',
          sessionDate: '2026-08-16',
          sessionType: 'STANDARD',
        },
      },
    ]);

    let capturedUrl = '';
    let capturedPayload: any = null;

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedPayload = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            results: [
              {
                clientEventId: capturedPayload.events[0].clientEventId,
                status: 'ACCEPTED',
              },
            ],
            sessionMappings: [],
          },
        }),
      } as Response;
    };

    // 2. Sync specifically for School B
    const syncRes = await syncOutboxEvents({
      schoolId: 'school-b',
      deviceIdentifier: 'test-device-b',
      customFetch: mockFetch as any,
    });

    expect(syncRes.syncedCount).toBe(1);
    expect(capturedUrl).toContain('/api/v1/schools/school-b/sync/attendance-events');
    expect(capturedPayload.events).toHaveLength(1);
    expect(capturedPayload.events[0].clientEventId).toBe('evt-school-b-1');
    expect(capturedPayload.events[0].studentId).toBe('stud-b-1');

    // 3. Verify School A record remains untouched and still PENDING
    const remainingA = await offlineDb.syncOutbox.get('evt-school-a-1');
    expect(remainingA?.syncStatus).toBe('PENDING');

    // 4. Verify School B record is now marked SYNCED
    const syncedB = await offlineDb.syncOutbox.get('evt-school-b-1');
    expect(syncedB?.syncStatus).toBe('SYNCED');
  });

  it('throws SCHOOL_ID_REQUIRED if syncOutboxEvents is invoked without schoolId', async () => {
    await expect(
      syncOutboxEvents({
        schoolId: '',
        deviceIdentifier: 'test-dev',
      })
    ).rejects.toThrow('SCHOOL_ID_REQUIRED');
  });
});
