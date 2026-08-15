# School-Site RFID Physical On-Site Hardware Certification Protocol

> **Note**: Historical reference document / not an active product claim. For active feature status, see [STATUS.md](STATUS.md).

## 1. Scope & Objective
This document defines the physical hardware commissioning and on-site certification protocol required before commercial RFID attendance service is activated at a school facility.

> [!IMPORTANT]
> **Current Certification Status**: **PENDING PHYSICAL ON-SITE COMMISSIONING**  
> Software architecture and cryptographic resilience have been verified through automated model testing ([`scripts/rfid-resilience-model-test.ts`](../scripts/rfid-resilience-model-test.ts)). Physical commercial certification requires on-site execution with physical hardware, recorded serial numbers, firmware verification, and physical sign-offs.

---

## 2. On-Site Hardware Inventory & Asset Identification

Before commencing on-site testing, record the physical attributes of installed hardware:

| Asset | Model / Specification | Serial Number | Firmware Version | MAC / Hardware ID | Inspection |
|---|---|---|---|---|:---:|
| **Gate 1 Reader (North)** | NXP DESFire EV2/EV3 ISO 14443-A | `________________` | `v____________` | `________________` | [ ] Pending |
| **Gate 2 Reader (South)** | NXP DESFire EV2/EV3 ISO 14443-A | `________________` | `v____________` | `________________` | [ ] Pending |
| **Edge Gateway Appliance** | Fanless Industrial Edge Gateway | `________________` | `v____________` | `________________` | [ ] Pending |
| **Backup UPS Unit** | 1000VA Pure Sine Wave Online UPS | `________________` | `v____________` | `________________` | [ ] Pending |

---

## 3. Physical Field Test Matrix (To Be Executed On-Site)

| # | Physical Test Scenario | Acceptance Criteria | Field Execution Verification Method | On-Site Result | Sign-Off |
|---|---|---|---|:---:|:---:|
| **1** | **Dual Readers Operating Simultaneously** | 0 scan collisions, concurrent AES-CMAC verification at Gate 1 and Gate 2. | Tap 50 physical cards simultaneously on both readers within 10 seconds. | **NOT TESTED** | `_______` |
| **2** | **Duplicate & Rapid Scans** | 30-second anti-passback cooldown strictly enforced. Repeated taps within cooldown return duplicate cache ACK without double-marking. | Present same physical card at 0s, 2s, and 5s. Verify single attendance mark. | **NOT TESTED** | `_______` |
| **3** | **Internet Disconnection & Recovery** | Uninterrupted offline attendance collection into local encrypted SQLite WAL queue. 100% replay upon reconnection without scan loss. | Physically unplug WAN Ethernet cable for 60 minutes during morning arrival. Reconnect and audit outbox flush. | **NOT TESTED** | `_______` |
| **4** | **Power Interruption & Recovery** | Zero NVRAM / WAL corruption on sudden power loss. Automatic daemon recovery upon cold boot. | Switch off main breaker during active scanning. Restore power and verify zero record loss. | **NOT TESTED** | `_______` |
| **5** | **Gateway Restart & Crash Resilience** | In-flight batches resume from last acknowledged offset. No duplicate records in cloud database. | Execute `kill -9` on gateway daemon while batch is transmitting. | **NOT TESTED** | `_______` |
| **6** | **Damaged, Unknown & Tampered Cards** | Malformed APDUs, revoked UIDs, and invalid CMAC tokens rejected with visual red LED indicator and logged to Incident Queue. | Present unprovisioned MIFARE Classic, revoked card, and damaged transponder. | **NOT TESTED** | `_______` |
| **7** | **Peak Arrival Traffic Burst** | Handle sustained 120 taps/minute per gate with P99 tap response latency < 100ms. | High-density arrival drill with 200+ students across Gate 1 & 2. | **NOT TESTED** | `_______` |
| **8** | **Zero-Loss End-of-Day Sync** | 100% mathematical reconciliation between gateway local counter, SQLite WAL entries, and cloud PostgreSQL database. | Run end-of-day audit script comparing local gateway transaction log against cloud database. | **NOT TESTED** | `_______` |

---

## 4. Software Model Verification (Automated Simulation)
To verify the software resilience algorithms and cryptographic models prior to field deployment:
```bash
npx tsx scripts/rfid-resilience-model-test.ts
```
Outputs model report to `output/rfid-resilience-model-report.md`.

---

## 5. Formal Physical Deployment Sign-Off

Physical certification is considered complete only when all 8 physical scenarios have been executed on-site and signed off below:

| Role | Stakeholder Name | Physical Signature | Date |
|---|---|---|---|
| **Lead Hardware Engineer** | _______________________ | _______________________ | ______________ |
| **School IT Administrator** | _______________________ | _______________________ | ______________ |
| **School Principal / Head Teacher** | _______________________ | _______________________ | ______________ |
