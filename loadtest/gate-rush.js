import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const batchMs = new Trend('batch_ms');
const lostReads = new Counter('lost_reads');

export const options = {
  scenarios: {
    gate_rush: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 50,
      stages: [
        { duration: '30s', target: 4 },
        { duration: '1m', target: 8 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    batch_ms: ['p(95)<2500', 'p(99)<4000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCHOOL_ID = __ENV.SCHOOL_ID || '00000000-0000-0000-0000-000000000001';
const BEARER_TOKEN = __ENV.BEARER_TOKEN || 'reader-test-token';
const READERS = ['FX9600-GATE-01', 'FX9600-GATE-02', 'FX9600-GATE-03', 'FX9600-GATE-04'];

export default function () {
  const readerId = READERS[Math.floor(Math.random() * READERS.length)];
  const batchSize = Math.floor(Math.random() * 40) + 20; // 20 to 60 reads
  const now = new Date();

  const data = [];
  for (let i = 0; i < batchSize; i++) {
    const studentIdx = Math.floor(Math.random() * 200) + 1;
    const epcHex = `E28011700000000000${String(studentIdx).padStart(6, '0')}`;
    data.push({
      idHex: epcHex,
      antenna: (i % 4) + 1,
      peakRssi: -50 - Math.floor(Math.random() * 25),
      timestamp: new Date(now.getTime() - i * 50).toISOString(),
    });
  }

  const payload = JSON.stringify({ data });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'x-reader-id': readerId,
    },
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/${SCHOOL_ID}/rfid/zebra/reads`, payload, params);
  const duration = Date.now() - start;
  batchMs.add(duration);

  const passed = check(res, {
    'status is 200 or 207': (r) => r.status === 200 || r.status === 207,
  });

  if (!passed) {
    lostReads.add(batchSize);
  }

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    'loadtest/out/summary.json': JSON.stringify(data, null, 2),
    stdout: `p95=${data.metrics.batch_ms?.values?.['p(95)']?.toFixed(0) ?? 'N/A'}ms p99=${data.metrics.batch_ms?.values?.['p(99)']?.toFixed(0) ?? 'N/A'}ms lost=${data.metrics.lost_reads?.values?.count ?? 0}\n`,
  };
}
