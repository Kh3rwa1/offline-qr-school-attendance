# AttendEase OS — Multi-Tenant Load Benchmark Methodology

> **Document Status**: `ENGINEERING_SPECIFICATION`  
> **Reference**: Executable test scripts in `scripts/runLoadSmokeBenchmark.ts` and `scripts/runFullScaleLoadTest.ts`.

---

## 1. Multi-Tenant Scale Model

The performance test suite models a regional school district deployment across 100 independent schools and 500,000 enrolled students:

| Parameter | Scale Benchmark Dimension |
| :--- | :--- |
| **Total Participating Schools** | 100 distinct multi-tenant school workspaces |
| **Total Enrolled Students** | 500,000 active student records with encrypted credentials |
| **Class Sections** | ~10,000 distinct class sections (50 students per section average) |
| **Daily Attendance Volume** | 500,000 attendance records generated per simulated school day |
| **Primary Ingest Modes** | 70% Mobile QR Scans + 30% UHF RFID Gate Tag Reads |
| **Notification Volume** | ~40,000 absence SMS notifications enqueued daily (8% absence rate) |

---

## 2. Benchmark Scenario Matrix (10 Scenarios)

The benchmark executes 10 realistic morning operational scenarios:

1. **Scenario 1: Normal School-Day Roster & Session Retrieval**: Teachers loading class rosters and session status.
2. **Scenario 2: Morning Authentication & Session Burst**: Concurrent teacher and administrator logins using Argon2id password verification.
3. **Scenario 3: QR Credential Retrieval & Validation**: Ingestion of signed student QR credentials.
4. **Scenario 4: Offline Attendance Batch Synchronization Storm**: Teachers reconnecting after taking offline roll in remote classrooms.
5. **Scenario 5: Duplicate Replay & Idempotency Reconciliation Storm**: Simultaneous duplicate scans from same or multiple cameras.
6. **Scenario 6: Multi-Tenant Attendance Report Query Workload**: School administrators generating daily attendance digests.
7. **Scenario 7: SMS & Notification Queue Burst**: Processing background transactional absence messages.
8. **Scenario 8: Redis Latency & Distributed Rate Limiter Pressure**: Token-bucket rate limiting and session validation under high concurrency.
9. **Scenario 9: PostgreSQL Pool & Connection Pressure (100 Schools)**: Connection pool contention across multi-tenant contexts.
10. **Scenario 10: Large Dataset Scale Query (500k Students Roster & Export)**: Complex joins across 500,000 rows.

---

## 3. Post-Load Database Integrity Verification

Immediately following load execution, the automated test harness executes 5 SQL integrity audits:
1. **Uniqueness Audit**: Confirms `COUNT(DISTINCT (student_id, date)) == COUNT(*)`.
2. **Foreign Key Integrity**: Proves zero orphaned attendance records exist.
3. **Tenant Boundary Audit**: Validates that all attendance records reference valid schools in active state.
4. **RLS Verification**: Proves that unauthenticated or standard teacher queries return 0 cross-school records.
5. **Checksum Manifest**: Generates SHA-256 digests of all generated benchmark reports.
