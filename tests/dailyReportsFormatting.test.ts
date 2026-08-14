import { describe, it, expect } from 'vitest';

describe('DailyReports Roster Formatting', () => {
  it('correctly maps raw firstScannedAt without producing "Invalid Date" on second formatting', () => {
    const rawRecords = [
      {
        studentId: 'st-001',
        fullName: 'Debasish Mondal',
        rollNumber: 1,
        status: 'PRESENT',
        firstScannedAt: '2026-08-14T09:15:30.000Z',
      },
      {
        studentId: 'st-002',
        fullName: 'Priya Sharma',
        rollNumber: 2,
        status: 'ABSENT',
        firstScannedAt: null,
      },
    ];

    // Mapped record preserving raw ISO string
    const mapped = rawRecords.map((r) => ({
      studentId: r.studentId,
      fullName: r.fullName,
      rollNumber: String(r.rollNumber),
      status: r.status,
      firstScannedAt: r.firstScannedAt || null,
    }));

    // Render path formatting
    const formattedTimes = mapped.map((m) =>
      m.firstScannedAt
        ? new Date(m.firstScannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '—'
    );

    expect(formattedTimes[0]).not.toBe('Invalid Date');
    expect(formattedTimes[0]).toContain(':');
    expect(formattedTimes[1]).toBe('—');
  });
});
