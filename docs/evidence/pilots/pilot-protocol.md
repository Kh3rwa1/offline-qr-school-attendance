# School Pilot Protocol & Staged Rollout

## Rollout Schedule

| Week | Mode | Operating Procedures |
|---|---|---|
| **0** | **Pre-deployment** | Site survey, antenna mounting, RF power tuning, consent collection sent home. Enrol 100% of pilot classes. |
| **1–2** | **SHADOW** | Teachers take normal attendance roll (ground truth). RFID decisions are logged in `rfid_scan_events` without modifying attendance records or sending SMS. Daily antenna tuning using the anomaly review report. |
| **3** | **ASSISTED** | RFID pre-fills the roll; teachers review and confirm. SMS remains disabled. |
| **4** | **LIVE** | Full automated RFID attendance with SMS dispatch enabled under the 20-minute safety delay window. Dedicated on-site engineer on call every morning. |

Target cohort: 2–4 classes (~100–150 students), 1 main entrance gate equipped with 1 Zebra FX9600 reader.

---

## Exit Criteria Across Stages

Agreement on exit criteria must be signed in writing prior to pilot commencement. Criteria may not be modified retroactively.

| Metric | SHADOW → ASSISTED Target | ASSISTED → LIVE Target |
|---|---|---|
| **Read rate** | ≥ 97.0 % for 5 consecutive days | ≥ 99.0 % |
| **False present rate** | ≤ 0.5 % | ≤ 0.2 % |
| **p95 gate→system latency** | < 10.0 s | < 10.0 s |
| **Unexplained `MULTI_READER_BURST`** | Trending down | 0 incidents / day |
| **Wrong absence SMS sent** | N/A (SMS disabled) | **0** (any false absence triggers immediate stop and review) |

---

## Qualitative Evidence Collection

1. **Teacher Survey (Weeks 2 & 4):**
   - Minutes spent conducting morning roll versus pre-pilot baseline.
   - Trust and confidence score (1 to 5 scale).
   - Observed friction points, student queueing, or tag damage.

2. **Staffroom Debrief Interview:**
   - Formal qualitative interview with school administrative staff at the end of Week 4.

3. **Time Savings Measurement:**
   - Measured empirically by timing attendance execution directly across pilot classes rather than relying on self-reported estimates.
