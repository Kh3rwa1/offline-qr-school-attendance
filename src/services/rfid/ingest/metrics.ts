import type { Outcome } from './types';

const STAGE_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

const readCountsByDecision = new Map<string, number>();
const stageBucketCounts = new Map<string, number[]>();
const stageSums = new Map<string, number>();
const stageTotalCounts = new Map<string, number>();

export function timer() {
  const t0 = performance.now();
  let last = t0;
  const stages: Record<string, number> = {};
  return {
    mark(stage: string) {
      const n = performance.now();
      stages[stage] = (n - last) / 1000;
      last = n;
    },
    done() {
      stages.total = (performance.now() - t0) / 1000;
      return stages;
    },
  };
}

export function recordBatchMetrics(_readerId: string, all: Outcome[], stages: Record<string, number>) {
  for (const o of all) {
    const cur = readCountsByDecision.get(o.decision) ?? 0;
    readCountsByDecision.set(o.decision, cur + 1);
  }

  for (const [stage, s] of Object.entries(stages)) {
    if (!stageBucketCounts.has(stage)) {
      stageBucketCounts.set(stage, STAGE_BUCKETS.map(() => 0));
      stageSums.set(stage, 0);
      stageTotalCounts.set(stage, 0);
    }
    const buckets = stageBucketCounts.get(stage)!;
    for (let i = 0; i < STAGE_BUCKETS.length; i++) {
      const bound = STAGE_BUCKETS[i];
      if (bound !== undefined && s <= bound) {
        buckets[i] = (buckets[i] ?? 0) + 1;
      }
    }
    stageSums.set(stage, (stageSums.get(stage) ?? 0) + s);
    stageTotalCounts.set(stage, (stageTotalCounts.get(stage) ?? 0) + 1);
  }
}

export function renderRfidIngestMetrics(): string[] {
  const lines: string[] = [];

  lines.push('# HELP attendease_rfid_reads_total RFID reads by decision');
  lines.push('# TYPE attendease_rfid_reads_total counter');
  for (const [decision, count] of readCountsByDecision.entries()) {
    lines.push(`attendease_rfid_reads_total{decision="${decision}"} ${count}`);
  }

  lines.push('# HELP attendease_rfid_batch_seconds Batch stage latency');
  lines.push('# TYPE attendease_rfid_batch_seconds histogram');
  for (const [stage, buckets] of stageBucketCounts.entries()) {
    for (let i = 0; i < STAGE_BUCKETS.length; i++) {
      lines.push(`attendease_rfid_batch_seconds_bucket{stage="${stage}",le="${STAGE_BUCKETS[i]}"} ${buckets[i]}`);
    }
    const totalCount = stageTotalCounts.get(stage) ?? 0;
    const sum = stageSums.get(stage) ?? 0;
    lines.push(`attendease_rfid_batch_seconds_bucket{stage="${stage}",le="+Inf"} ${totalCount}`);
    lines.push(`attendease_rfid_batch_seconds_sum{stage="${stage}"} ${sum}`);
    lines.push(`attendease_rfid_batch_seconds_count{stage="${stage}"} ${totalCount}`);
  }

  return lines;
}
