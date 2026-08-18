# Zebra FX9600 Physical Commissioning Evidence Requirements

> **Document Status**: `ENGINEERING_SPECIFICATION`  
> **Purpose**: Establishes formal criteria for verifying physical on-site deployment of Zebra FX9600 UHF RFID readers before elevating status to `EXTERNALLY_VALIDATED`.

---

## 1. Hardware Readiness Level Hierarchy

AttendEase OS classifies hardware readiness across three distinct tiers:

```
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 1: UNIT_TESTED (AUTOMATION_VERIFIED)                 │
│ - Canonical EPC hashing & last-4 character extraction       │
│ - IoT Connector JSON schema normalization & validation     │
│ - Exact raw-body HMAC-SHA256 & Bearer token verification    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 2: SIMULATOR_VALIDATED (AUTOMATION_VERIFIED)          │
│ - Full HTTP webhook simulation via hardware-runner.ts       │
│ - Doorway burst rate simulation (600 reads/min)             │
│ - Duplicate debounce and Redis distributed locking          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 3: PHYSICALLY_COMMISSIONED (EXTERNALLY_PENDING)        │
│ - Physical reader deployed at entrance gate in school       │
│ - Antenna array tuned to regional RF regulations (865-867MHz)│
│ - Physical tags tested on students in natural flow          │
│ - Signed acceptance report from on-site technician          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mandatory Evidence Artifacts for Level 3 Elevation

To promote a school deployment from `EXTERNALLY_PENDING` to `EXTERNALLY_VALIDATED`, the following 5 evidence artifacts must be submitted:

### Artifact 1: Physical Hardware & Installation Photographs
- High-resolution photograph of the installed Zebra FX9600 reader showing mounting, grounding, and Ethernet cabling.
- High-resolution photograph of the reader backplane label clearly showing the serial number and MAC address.
- Photograph of the antenna mounting array at the entrance gate showing aperture height and orientation.

### Artifact 2: RF Tuning & Calibration Telemetry
- Antenna port forward power and reflected power measurements (VSWR $\le 1.3:1$).
- RSSI distribution log across 50 sample reads demonstrating read sensitivity between $-40\text{ dBm}$ and $-65\text{ dBm}$ across the doorway width.

### Artifact 3: Raw Webhook Ingest Logs
- Minimum 100 sequential JSON payloads captured directly from the IoT Connector webhook during morning entrance.
- Verification that all payloads match the documented shape and pass signature validation.

### Artifact 4: Database State & Audit Query Results
- SQL query verifying:
  1. $1:1$ mapping of enrolled students to attendance records with status `PRESENT` and capture method `RFID_GATE`.
  2. Complete absence of duplicate rows for the session.
  3. All records in `rfid_scan_events` store 64-character SHA-256 digests (`epc_digest`), with zero raw EPC strings.

### Artifact 5: Completed & Signed Commissioning Form
- Form completed using `docs/hardware/FX9600_COMMISSIONING_TEMPLATE.md` signed by both the deploying technician and the school administrator.
