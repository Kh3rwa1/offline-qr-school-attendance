import crypto from 'node:crypto';
import { AppError } from '../../../errors/AppError';
import {
  canonicalizeEpc,
  canonicalizeTid,
  computeEpcDigest,
  computeTidDigest,
  getEpcLastFour,
} from '../cryptoService';
import { classifyReadTime } from '../readFreshness';
import { MAX_BATCH_READS } from '../zebraIotConnector';
import type { NormalizedRead, MalformedRead, Outcome } from './types';

type Raw = Record<string, unknown>;

function sanitizePayload(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return true;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return false;
    }
    if (typeof (obj as any)[key] === 'object' && (obj as any)[key] !== null) {
      if (!sanitizePayload((obj as any)[key])) return false;
    }
  }
  return true;
}

/** Accepts every payload shape the connector accepted, plus element-level `data` objects. */
export function extractRawReads(payload: unknown): Raw[] {
  if (!sanitizePayload(payload)) {
    throw new AppError('MALFORMED_PAYLOAD', 400, 'Prototype pollution keys detected');
  }

  let list: unknown;
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object') {
    const p = payload as Raw;
    list = p.data ?? p.tag_reads ?? p.events;
    // Single read object at root
    if (list === undefined && (p.epc || p.idHex || p.tag_id)) {
      list = [p];
    }
  }

  if (!Array.isArray(list)) {
    throw new AppError('MALFORMED_PAYLOAD', 400, 'Malformed payload');
  }
  if (list.length > MAX_BATCH_READS) {
    throw new AppError('BATCH_TOO_LARGE', 413, 'Too many reads in one batch');
  }

  return list.map((el) => {
    if (!el || typeof el !== 'object') return {};
    const e = el as Raw;
    // Flatten { data: {...}, timestamp } envelopes if present
    if (e.data && typeof e.data === 'object' && !Array.isArray(e.data)) {
      return { ...(e.data as Raw), timestamp: (e.data as Raw).timestamp ?? e.timestamp };
    }
    return e;
  });
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length <= 256 ? v : undefined);
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

function parseTime(v: unknown): Date | null {
  if (v === undefined || v === null || v === '') return null;
  const n = num(v);
  // Heuristic: < 1e12 → seconds, otherwise milliseconds
  const d = n !== null ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeReads(
  rawReads: Raw[],
  opts: { schoolId: string; readerId: string; now: Date; timezone: string }
): { reads: NormalizedRead[]; malformed: MalformedRead[] } {
  const reads: NormalizedRead[] = [];
  const malformed: MalformedRead[] = [];

  rawReads.forEach((r, index) => {
    // Own-property access only
    const epcRaw = str(r.epc) ?? str(r.idHex) ?? str(r.tag_id);
    if (!epcRaw) return malformed.push({ index, reason: 'missing_epc' });

    let epc: string;
    try {
      epc = canonicalizeEpc(epcRaw);
    } catch {
      return malformed.push({ index, reason: 'invalid_epc' });
    }

    let tidDigest: string | null = null;
    const tidRaw = str(r.tid) ?? str(r.tidHex);
    if (tidRaw) {
      try {
        tidDigest = computeTidDigest(canonicalizeTid(tidRaw), opts.schoolId);
      } catch {
        /* bad TID is not fatal; EPC is the identifier */
      }
    }

    const readerTs = parseTime(r.firstSeen ?? r.timestamp ?? r.lastSeen);
    const freshness = classifyReadTime(readerTs, opts.now, opts.timezone);
    const readAt = readerTs && freshness !== 'MISSING_TIMESTAMP' ? readerTs : opts.now;
    const epcDigest = computeEpcDigest(epc, opts.schoolId);
    const vendorId = str(r.vendorEventId) ?? str(r.eventId);

    reads.push({
      index,
      epcDigest,
      epcLast4: getEpcLastFour(epc),
      tidDigest,
      antenna: num(r.antenna ?? r.antenna_port),
      rssi: num(r.peakRssi ?? r.rssi),
      readAt,
      timeSource: readerTs ? 'READER' : 'SERVER',
      freshness,
      idempotencyKey: crypto
        .createHash('sha256')
        .update(
          vendorId
            ? `v:${opts.readerId}:${vendorId}`
            : `t:${opts.readerId}:${epcDigest}:${readAt.getTime()}`
        )
        .digest('hex'),
    });
  });

  return { reads, malformed };
}

/** Keep the earliest read per tag; later ones become DUPLICATE_IN_BATCH. */
export function dedupeInBatch(reads: NormalizedRead[]): { unique: NormalizedRead[]; dupes: Outcome[] } {
  const best = new Map<string, NormalizedRead>();
  for (const r of reads) {
    const cur = best.get(r.epcDigest);
    if (!cur || r.readAt < cur.readAt) best.set(r.epcDigest, r);
  }
  const keep = new Set([...best.values()].map((r) => r.index));
  const dupes = reads
    .filter((r) => !keep.has(r.index))
    .map((r) => ({ index: r.index, decision: 'DUPLICATE_IN_BATCH' as const, read: r }));
  return { unique: [...best.values()], dupes };
}
