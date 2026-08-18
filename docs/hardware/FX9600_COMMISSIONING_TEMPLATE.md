# Zebra FX9600 On-Site Physical Commissioning Runbook Template

> **Document Classification**: Field Engineering Template (Blank)  
> **Status**: `UNPOPULATED_TEMPLATE`  
> **Applicability**: To be executed on-site by a qualified embedded hardware technician during physical school deployment.

---

## 1. Hardware & Installation Information

| Field | Description / Value Placeholder |
| :--- | :--- |
| **School Name** | `[ENTER_OFFICIAL_SCHOOL_NAME]` |
| **School ID** | `[ENTER_ATTENDEASE_SCHOOL_UUID]` |
| **Installation Date & Time** | `[YYYY-MM-DD HH:MM IST]` |
| **Commissioning Technician Name** | `[ENTER_TECHNICIAN_FULL_NAME]` |
| **Technician Organization / Role** | `[ENTER_ORGANIZATION_OR_CONTRACTOR]` |
| **Zebra FX9600 Serial Number** | `[ENTER_HARDWARE_SERIAL_FROM_BACKPLANE]` |
| **Zebra FX9600 MAC Address** | `[ENTER_PHYSICAL_MAC_ADDRESS]` |
| **Reader Firmware Version** | `[ENTER_INSTALLED_FIRMWARE_BUILD]` |
| **IoT Connector Version** | `[ENTER_IOT_CONNECTOR_AGENT_VERSION]` |
| **Antenna Models & Ports** | `[e.g., Zebra AN480 Dual on Ports 1 & 2]` |
| **RF Power Calibration (dBm)** | `[e.g., 27.5 dBm configured for 2.2m aperture]` |
| **Operating Frequency Band** | `[e.g., India ETSI 865.0 - 867.0 MHz]` |
| **Network Configuration** | `[Static LAN IP / Subnet / Gateway]` |

---

## 2. On-Site Physical Commissioning Checklist

Execute each verification step sequentially. Do not mark complete until physical verification is observed and logged.

| Test ID | Test Scenario | Acceptance Criteria | Measured Field Observation | Verified |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | **Physical Mounting & Antenna Aperture** | Dual circularly polarized antennas securely mounted at entry doorway (2.0–2.4m height), cables strain-relieved. | Antenna height: `[ ]m`, Doorway width: `[ ]m` | [ ] |
| **TC-02** | **PoE+ / Power & Network Link** | FX9600 boots cleanly via 802.3at PoE+ or DC power supply; Ethernet link established at 1000BASE-T. | Switch port: `[ ]`, Link speed: `[ ]` | [ ] |
| **TC-03** | **IoT Connector Webhook Authentication** | Reader posts heartbeat and tag events with valid HMAC-SHA256 signature in `x-zebra-signature` or Bearer header; server returns HTTP 200. | Server response: `[HTTP 200 / 401]`, Auth mode: `[HMAC/Bearer]` | [ ] |
| **TC-04** | **Single Enrolled Student Walk-Through** | Enrolled student walks through gate at normal walking speed (1.0–1.4 m/s); tag read within 100ms; attendance marked `PRESENT`. | Observed RSSI: `[ ] dBm`, Ingest latency: `[ ] ms` | [ ] |
| **TC-05** | **Duplicate Walk & Lingering Debounce** | Student lingers in beam or re-enters within 30 seconds; server returns `DUPLICATE` without creating multiple attendance rows. | Duplicate rejection confirmed in logs: `[YES/NO]` | [ ] |
| **TC-06** | **Unregistered / Revoked Tag Handling** | Unregistered or revoked EPC tag passes antenna; server logs security digest and returns `UNKNOWN_CARD` or `REVOKED_CARD` without DB corruption. | Rejection code: `[ ]`, 0 erroneous records created | [ ] |
| **TC-07** | **Burst Rush-Hour Ingest (>20 Students)** | Group of 20+ students passes through gate within 15 seconds; all enrolled students correctly recorded; 0 HTTP 429 throttles. | Total burst count: `[ ]`, Processed count: `[ ]` | [ ] |
| **TC-08** | **Teacher Review Dashboard Sync** | Teacher opens AttendEase dashboard; live gate feed displays real-time arrivals with correct class section mapping. | Display match confirmed: `[YES/NO]` | [ ] |
| **TC-09** | **Session Finalization & Auto-Absent** | Teacher finalizes session; unmarked enrolled students convert to `ABSENT`; parent notification jobs queued. | Finalized at: `[HH:MM]`, Absent count: `[ ]` | [ ] |

---

## 3. Required Evidence Artifacts

Attach the following mandatory artifacts to complete the commissioning dossier:
1. **Photographs**: Wide shot of reader gate installation and close-up of FX9600 backplane serial label.
2. **Raw Webhook Ingest Log**: Export of first 50 tag-read JSON payloads received by AttendEase.
3. **Database Audit Proof**: SQL query output confirming SHA-256 digested EPCs and zero duplicate rows.
4. **RF Spectrum Calibration Log**: RSSI distribution across doorway aperture.

---

## 4. On-Site Commissioning Sign-Off

```markdown
### Physical Hardware Commissioning Sign-Off Record

- **School Name**: ____________________________________________________
- **Installation Date**: _____________________________________________
- **Technician Name**: _______________________________________________
- **Technician Signature**: __________________________________________
- **School Authority Name**: _________________________________________
- **School Authority Signature**: ____________________________________
- **Commissioning Status**: [ ] PASSED  [ ] CONDITIONAL  [ ] FAILED
```
