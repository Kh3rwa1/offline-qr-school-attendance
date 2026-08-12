import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    morning_login_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 500 }, // Burst 500 req/sec
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<1500'],
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

  const res = http.get(`${BASE_URL}/api/v1/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'healthy database': (r) => r.json().database === 'healthy',
  });

  sleep(1);
}
