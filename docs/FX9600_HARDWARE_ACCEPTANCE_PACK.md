# Zebra FX9600 Hardware Acceptance Pack & Reference Specification

> **Document Status**: `SOFTWARE_CONTRACT_VERIFIED_NO_PHYSICAL_HARDWARE`  
> **Physical Deployment Status**: `EXTERNALLY_PENDING`  
> **Reference**: See [`docs/hardware/FX9600_COMMISSIONING_TEMPLATE.md`](hardware/FX9600_COMMISSIONING_TEMPLATE.md) for the unpopulated field commissioning runbook and [`docs/hardware/FX9600_EVIDENCE_REQUIREMENTS.md`](hardware/FX9600_EVIDENCE_REQUIREMENTS.md) for physical evidence requirements.

---

## 1. Overview & Verification Status Hierarchy

Software integration with the **Zebra FX9600 UHF RFID Reader** is fully implemented and automated in CI:
- **Level 1 (Unit Tested)**: `AUTOMATION_VERIFIED` — EPC canonicalization, digest computation, HMAC-SHA256 verification, and Bearer token parsing are validated by test suites in `tests/rfid/`.
- **Level 2 (Simulator Validated)**: `AUTOMATION_VERIFIED` — End-to-end webhook ingest, doorway burst rate simulation, and duplicate debounce filtering are validated by `scripts/hardware-runner.ts`.
- **Level 3 (Physically Commissioned)**: `EXTERNALLY_PENDING` — On-site deployment in a physical school with real doorway RF calibration is pending real-world installation.

---

## 2. Technical Integration Architecture

### Hardware Specifications
- **Reader Model**: Zebra FX9600 Fixed RFID Reader (4-port or 8-port India/ETSI 865.0–867.0 MHz SKU).
- **Antenna Type**: Dual circularly polarized patch antennas (e.g., Zebra AN480).
- **Tag Standard**: EPC Class 1 Gen 2 / ISO 18000-63.
- **Protocol**: HTTP/HTTPS Webhook from embedded Zebra IoT Connector client.
- **Payload Format**: JSON tag-read arrays (`idHex`, `antenna`, `peakRssi`, `timestamp`).

### Webhook Security Specification
- **Endpoint**: `POST /api/v1/schools/:schoolId/rfid/zebra/reads`
- **HMAC Signature**: Header `x-zebra-signature: <sha256_hex(rawBody, readerSecret)>` or `sha256=<hex>`.
- **Bearer Token**: Header `Authorization: Bearer <reader_token>`.
- **Digest Storage**: Canonical EPC strings are hashed with SHA-256 upon ingest; raw tag IDs are discarded immediately after credential lookup.

---

## 3. Physical Commissioning Verification Steps

When deploying physical hardware on-site, technicians follow the test scenarios outlined in [`docs/hardware/FX9600_COMMISSIONING_TEMPLATE.md`](hardware/FX9600_COMMISSIONING_TEMPLATE.md):

1. **TC-01: Physical Mounting & Aperture**: Mounting dual antennas at 2.0–2.4m height.
2. **TC-02: Power & Connectivity**: Establishing 802.3at PoE+ and 1000BASE-T link.
3. **TC-03: Webhook Authentication**: Verifying HMAC signature verification against the AttendEase appliance.
4. **TC-04: Single Student Walk-Through**: Testing read sensitivity and 1:1 attendance record creation.
5. **TC-05: Debounce Filtering**: Validating that lingering tags are debounced for 30 seconds.
6. **TC-06: Unregistered Tag Rejection**: Confirming unknown tags return rejection codes without DB writes.
7. **TC-07: Rush-Hour Group Entry**: Validating group throughput (>20 students) without throttling.
8. **TC-08: Teacher Dashboard Feed**: Confirming live gate arrivals appear in real time.
9. **TC-09: Session Finalization**: Confirming auto-absent conversion and parent notification queueing.

---

## 4. Evidence Requirements for Elevation

To elevate Level 3 status to `EXTERNALLY_VALIDATED`, submit the 5 required artifacts defined in [`docs/hardware/FX9600_EVIDENCE_REQUIREMENTS.md`](hardware/FX9600_EVIDENCE_REQUIREMENTS.md).
