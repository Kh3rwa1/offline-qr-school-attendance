import { eq } from 'drizzle-orm';
import { withTenantContext } from '../../../db';
import { schools } from '../../../db/schema';
import { authenticateZebraRequest } from '../zebraAuth';
import { extractRawReads, normalizeReads, dedupeInBatch } from './normalize';
import { loadDebounced, markDebounced } from './debounce';
import { loadContext } from './loadContext';
import { decideRead } from './decide';
import { writeOutcomes } from './write';
import { recordBatchMetrics, timer } from './metrics';
import { ACCEPTED_DECISIONS, DUPLICATE_DECISIONS, type Outcome } from './types';

const schoolSettingsCache = new Map<string, { timezone: string; expiresAt: number }>();

export async function getSchoolSettings(schoolId: string): Promise<{ timezone: string }> {
  const cached = schoolSettingsCache.get(schoolId);
  if (cached && Date.now() < cached.expiresAt) {
    return { timezone: cached.timezone };
  }
  const timezone = await withTenantContext(schoolId, async (tx) => {
    const [sc] = await tx
      .select({ timezone: schools.timezone })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);
    return sc?.timezone || 'Asia/Kolkata';
  });
  schoolSettingsCache.set(schoolId, { timezone, expiresAt: Date.now() + 60_000 });
  return { timezone };
}

function readerIdFrom(body: unknown, headers: Record<string, string | string[] | undefined>): string | undefined {
  const headerId =
    (headers['x-reader-id'] as string) ||
    (headers['x-zebra-reader-id'] as string) ||
    (headers['x-device-id'] as string);
  if (headerId) return headerId;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const val = b['reader_name'] || b['hostname'] || b['deviceId'] || b['readerId'];
    if (typeof val === 'string') return val;
  }
  return undefined;
}

export function toSchoolDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function summarize(all: Outcome[], processedCount: number) {
  let acceptedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;
  for (const o of all) {
    if (ACCEPTED_DECISIONS.has(o.decision)) acceptedCount++;
    else if (DUPLICATE_DECISIONS.has(o.decision)) duplicateCount++;
    else rejectedCount++;
  }
  if (acceptedCount + duplicateCount + rejectedCount !== processedCount || all.length !== processedCount) {
    // Invariant violation = bug. Fail loudly in test, log loudly in prod.
    const err = new Error(`INGEST_INVARIANT: ${all.length} results for ${processedCount} reads`);
    if (process.env.NODE_ENV !== 'production') throw err;
    console.error(err);
  }
  return { processedCount, acceptedCount, duplicateCount, rejectedCount };
}

export async function processZebraBatch(input: {
  schoolId: string;
  rawBody: Buffer;
  parsedBody: unknown;
  headers: Record<string, string | string[] | undefined>;
  now?: Date;
}) {
  const t = timer();
  const now = input.now ?? new Date();

  const rawReads = extractRawReads(input.parsedBody);
  const reader = await authenticateZebraRequest({
    schoolId: input.schoolId,
    headers: input.headers,
    rawBody: input.rawBody,
    readerIdentifier: readerIdFrom(input.parsedBody, input.headers),
  });
  const { timezone } = await getSchoolSettings(input.schoolId);
  t.mark('auth');

  const { reads, malformed } = normalizeReads(rawReads, {
    schoolId: input.schoolId,
    readerId: reader.id,
    now,
    timezone,
  });
  const { unique, dupes } = dedupeInBatch(reads);
  const debounced = await loadDebounced(
    input.schoolId,
    unique.map((r) => r.epcDigest)
  );
  t.mark('normalize');

  const schoolDate = toSchoolDate(now, timezone);
  const outcomes: Outcome[] = await withTenantContext(input.schoolId, async (tx) => {
    const ctx = await loadContext(tx, {
      schoolId: input.schoolId,
      schoolDate,
      reads: unique,
      debounced,
    });
    t.mark('load');
    const decided = unique.map((r) => decideRead(r, ctx));
    const written = await writeOutcomes(tx, ctx, decided, reader);
    t.mark('write');
    return written;
  });

  // Post-commit only
  await markDebounced(
    input.schoolId,
    outcomes.filter((o) => ACCEPTED_DECISIONS.has(o.decision)).map((o) => o.read!.epcDigest)
  );

  const all: Outcome[] = [
    ...outcomes,
    ...dupes,
    ...malformed.map((m) => ({ index: m.index, decision: 'MALFORMED_READ' as const })),
  ].sort((a, b) => a.index - b.index);

  const summary = summarize(all, rawReads.length);
  recordBatchMetrics(reader.id, all, t.done());

  return {
    success: true,
    readerId: reader.id,
    readerName: reader.name,
    ...summary,
    results: all.map((o) => ({
      index: o.index,
      decision: o.decision,
      epcLastFour: o.read?.epcLast4,
      studentId: o.studentId,
      reviewFlag: o.reviewFlag,
    })),
  };
}
