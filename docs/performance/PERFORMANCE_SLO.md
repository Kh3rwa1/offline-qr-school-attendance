# AttendEase OS — Performance Service Level Objectives (SLO)

> **Document Status**: `ENGINEERING_SPECIFICATION`  
> **Applicability**: Performance thresholds and testing profile definitions for AttendEase OS.

---

## 1. Performance Profiles & Execution Environments

To prevent false-positive CI failures while maintaining strict production standards, AttendEase OS differentiates two distinct performance operational profiles:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PROFILE A: SHARED_CI_SMOKE                                             │
│ Environment: Shared GitHub Actions Ubuntu Runners (2 vCPU, variable load)│
│ Purpose: Smoke verification of load generation, scenarios, and DB integrity│
│ Thresholds: Relaxed to accommodate shared virtual machine latency jitter │
│ - General API p95 Latency: < 2,500 ms                                  │
│ - Auth & Session p95 Latency: < 3,500 ms                               │
│ - Error Rate: 0.00% unexpected failures                                │
│ - Database Post-Load Integrity: 100% PASS                              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ PROFILE B: CONTROLLED_PERFORMANCE_SLO                                  │
│ Environment: Dedicated Bare-Metal / Dedicated VM Appliance (8 vCPU, 16GB)│
│ Purpose: Authoritative production performance certification (500k scale)│
│ Thresholds: Strict production engineering SLOs                         │
│ - General API p95 Latency: < 300 ms                                    │
│ - Auth & Session p95 Latency: < 600 ms                                 │
│ - RFID Doorway Burst Ingest: < 100 ms                                  │
│ - Sustained Throughput: >= 500 RPS                                     │
│ - Error Rate: < 0.01% (excluding intentional auth rejections)          │
│ - Database Post-Load Integrity: 100% PASS                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Production SLO Target Specifications (Profile B)

| Workload / Endpoint | Concurrency | Target RPS | Target p50 | Target p95 | Target p99 | Max Error Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Zebra RFID Ingest Webhook** | 50 concurrent | 100 RPS | $\le 25\text{ ms}$ | $\le 100\text{ ms}$ | $\le 250\text{ ms}$ | 0.00% |
| **Student QR Attendance Scan** | 100 concurrent | 250 RPS | $\le 45\text{ ms}$ | $\le 150\text{ ms}$ | $\le 300\text{ ms}$ | 0.00% |
| **Offline Batch Sync Storm** | 30 concurrent | 50 RPS | $\le 80\text{ ms}$ | $\le 300\text{ ms}$ | $\le 600\text{ ms}$ | 0.00% |
| **Morning Auth & Session Burst** | 50 concurrent | 100 RPS | $\le 120\text{ ms}$ | $\le 600\text{ ms}$ | $\le 1,200\text{ ms}$ | 0.00% |
| **Attendance Roster Query (500k scale)** | 20 concurrent | 50 RPS | $\le 90\text{ ms}$ | $\le 350\text{ ms}$ | $\le 800\text{ ms}$ | 0.00% |
| **Parent SMS Notification Dispatch Queue**| Background worker | 200 msg/s | $\le 50\text{ ms}$ | $\le 200\text{ ms}$ | $\le 500\text{ ms}$ | 0.00% |

---

## 3. Database Integrity & Correctness SLO

Regardless of environment profile, zero data loss and strict consistency are mandatory:
1. **Duplicate Prevention**: Zero duplicate attendance records per student per date under concurrent bursts.
2. **Tenant Isolation**: Zero cross-tenant data leakage across 100 simulated school schemas.
3. **Session Immutability**: Finalized sessions reject new attendance insertions with HTTP 409 conflict.
4. **Audit Completeness**: All override actions and session state transitions generate immutable audit logs.
