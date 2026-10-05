import { getRedisClient } from '../../redisService';

const TTL_SEC = Number(process.env.RFID_DEBOUNCE_SECONDS ?? 30);
const key = (schoolId: string, digest: string) => `rfid:db:${schoolId}:${digest}`;

/** Fail-open: if Redis is down, nothing is debounced and Postgres idempotency takes over. */
export async function loadDebounced(schoolId: string, digests: string[]): Promise<Set<string>> {
  if (!digests.length) return new Set();
  try {
    const redis = getRedisClient();
    if (!redis) return new Set();
    const keys = digests.map((d) => key(schoolId, d));
    const vals = await redis.mget(...keys);
    return new Set(digests.filter((_, i) => vals[i] !== null));
  } catch {
    return new Set();
  }
}

/** Called ONLY after COMMIT, ONLY for accepted reads. */
export async function markDebounced(schoolId: string, digests: string[]): Promise<void> {
  if (!digests.length) return;
  try {
    const redis = getRedisClient();
    if (!redis) return;
    const pipeline = redis.pipeline();
    for (const d of digests) {
      pipeline.set(key(schoolId, d), '1', 'EX', TTL_SEC);
    }
    await pipeline.exec();
  } catch {
    /* non-fatal */
  }
}
