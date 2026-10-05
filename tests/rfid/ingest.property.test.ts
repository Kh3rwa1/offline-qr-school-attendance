import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { decideRead } from '../../src/services/rfid/ingest/decide';
import { dedupeInBatch } from '../../src/services/rfid/ingest/normalize';
import { summarize } from '../../src/services/rfid/ingest';
import { DECISIONS, type IngestContext, type NormalizedRead } from '../../src/services/rfid/ingest/types';

const digest = fc.constantFrom('d1', 'd2', 'd3', 'd4', 'd5', 'd6');
const readArb = (i: number) =>
  fc.record({
    index: fc.constant(i),
    epcDigest: digest,
    epcLast4: fc.constant('ABCD'),
    tidDigest: fc.constant(null),
    antenna: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
    rssi: fc.constant(null),
    readAt: fc
      .integer({
        min: new Date('2026-10-05T01:00:00Z').getTime(),
        max: new Date('2026-10-05T05:00:00Z').getTime(),
      })
      .map((t) => new Date(t)),
    timeSource: fc.constantFrom('READER', 'SERVER'),
    freshness: fc.constantFrom('OK', 'MISSING_TIMESTAMP', 'FUTURE_SKEW', 'WRONG_SCHOOL_DAY', 'LATE_BUFFERED'),
    idempotencyKey: fc.uuid(),
  }) as fc.Arbitrary<NormalizedRead>;

const batchArb = fc
  .integer({ min: 0, max: 60 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => readArb(i))));

const ctxArb: fc.Arbitrary<IngestContext> = fc
  .record({
    credStatus: fc.dictionary(digest, fc.constantFrom('ACTIVE', 'SUSPENDED')),
    studentStatus: fc.constantFrom('ACTIVE', 'INACTIVE', 'TRANSFERRED'),
    enrolled: fc.boolean(),
    sessionStatus: fc.constantFrom(undefined, 'OPEN', 'FINALIZED'),
    hasTeacher: fc.boolean(),
    isSchoolDay: fc.boolean(),
    debounced: fc.subarray(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']),
  })
  .map((g) => {
    const creds = Object.entries(g.credStatus).map(
      ([d, status]) => [d, { id: `c-${d}`, studentId: `s-${d}`, epcDigest: d, status }] as const
    );
    return {
      schoolId: 'sch',
      schoolDate: '2026-10-05',
      isSchoolDay: g.isSchoolDay,
      debounced: new Set(g.debounced),
      credsByDigest: new Map(creds),
      studentsById: new Map(
        creds.map(([, c]) => [c.studentId, { id: c.studentId, name: 'x', status: g.studentStatus, photoUrl: null }])
      ),
      enrollmentByStudent: g.enrolled
        ? new Map(creds.map(([, c]) => [c.studentId, { studentId: c.studentId, classSectionId: 'sec', rollNumber: null }]))
        : new Map(),
      sessionBySection: g.sessionStatus
        ? new Map([['sec', { id: 'sess', classSectionId: 'sec', status: g.sessionStatus }]])
        : new Map(),
      teacherBySection: g.hasTeacher ? new Map([['sec', 't1']]) : new Map(),
    };
  });

describe('ingest invariants', () => {
  it('every read gets exactly one valid decision', () => {
    fc.assert(
      fc.property(batchArb, ctxArb, (reads, ctx) => {
        const { unique, dupes } = dedupeInBatch(reads);
        const out = [...unique.map((r) => decideRead(r, ctx)), ...dupes];
        expect(out).toHaveLength(reads.length);
        expect(new Set(out.map((o) => o.index)).size).toBe(reads.length);
        for (const o of out) expect(DECISIONS).toContain(o.decision);
        expect(() => summarize(out, reads.length)).not.toThrow();
      })
    );
  });

  it('ACCEPTED implies every precondition holds', () => {
    fc.assert(
      fc.property(batchArb, ctxArb, (reads, ctx) => {
        for (const r of dedupeInBatch(reads).unique) {
          const o = decideRead(r, ctx);
          if (o.decision !== 'ACCEPTED') continue;
          const cred = ctx.credsByDigest.get(r.epcDigest)!;
          expect(cred.status).toBe('ACTIVE');
          expect(ctx.studentsById.get(cred.studentId)!.status).toBe('ACTIVE');
          expect(ctx.enrollmentByStudent.has(cred.studentId)).toBe(true);
          expect(ctx.isSchoolDay).toBe(true);
          expect(ctx.debounced.has(r.epcDigest)).toBe(false);
          expect(['FUTURE_SKEW', 'WRONG_SCHOOL_DAY']).not.toContain(r.freshness);
          expect(ctx.sessionBySection.get('sec')?.status).not.toBe('FINALIZED');
        }
      })
    );
  });

  it('dedupe keeps the earliest read per tag', () => {
    fc.assert(
      fc.property(batchArb, (reads) => {
        const { unique } = dedupeInBatch(reads);
        for (const u of unique) {
          const same = reads.filter((r) => r.epcDigest === u.epcDigest);
          expect(u.readAt.getTime()).toBe(Math.min(...same.map((r) => r.readAt.getTime())));
        }
      })
    );
  });

  it('decideRead is deterministic', () => {
    fc.assert(
      fc.property(batchArb, ctxArb, (reads, ctx) => {
        for (const r of reads) expect(decideRead(r, ctx)).toEqual(decideRead(r, ctx));
      })
    );
  });
});
