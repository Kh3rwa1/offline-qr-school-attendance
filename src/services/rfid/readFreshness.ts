export type Freshness = 'OK' | 'MISSING_TIMESTAMP' | 'FUTURE_SKEW' | 'WRONG_SCHOOL_DAY' | 'LATE_BUFFERED';

const MAX_FUTURE_SKEW_MS = 2 * 60_000; // reader clock ahead
const LATE_REVIEW_MS = 15 * 60_000; // buffered after a network blip

export function classifyReadTime(
  readTs: Date | null,
  now: Date,
  schoolTz = 'Asia/Kolkata'
): Freshness {
  if (!readTs || Number.isNaN(readTs.getTime())) return 'MISSING_TIMESTAMP';
  const delta = readTs.getTime() - now.getTime();
  if (delta > MAX_FUTURE_SKEW_MS) return 'FUTURE_SKEW';
  if (localDate(readTs, schoolTz) !== localDate(now, schoolTz)) return 'WRONG_SCHOOL_DAY';
  if (-delta > LATE_REVIEW_MS) return 'LATE_BUFFERED';
  return 'OK';
}

function localDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
