# Zebra FX9600 UHF RFID IoT Connector Integration Guide

AttendEase integrates directly with the **Zebra FX9600 Fixed RFID Reader** via its native **IoT Connector** HTTP webhook, capturing EPC Class 1 Gen 2 (ISO 18000-63) passive tag events for frictionless doorway gate attendance.

---

## 1. Hardware & Regional Frequency Warning

> [!WARNING]
> **Regulatory SKU Requirement**: For Indian deployments, deploy the **India/ETSI SKU (865–867 MHz)**. Do **NOT** procure or deploy FCC/US SKUs (902–928 MHz) as they violate DoT (Department of Telecommunications) spectrum allocations and will cause severe RF interference.

- **Reader Model**: Zebra FX9600 (4-port or 8-port antenna array, Ethernet/PoE).
- **Tag Standard**: EPC Class 1 Gen 2 / ISO 18000-63 passive UHF tags (inlays or PVC badges).
- **Communication Path**: Zebra IoT Connector push webhook over Ethernet LAN to AttendEase API. No PC/SC drivers, LLRP daemons, or Windows SDKs are used.

---

## 2. Webhook Ingest Endpoint

Configure the IoT Connector HTTP client profile on the FX9600 web console:

```http
POST https://<server-ip-or-domain>/api/v1/schools/:schoolId/rfid/zebra/reads
Content-Type: application/json
```

---

## 3. Cryptographic Authentication

The FX9600 IoT Connector authenticates every tag read envelope via HMAC-SHA256 signature or Bearer token. Unsigned or mismatched requests fail closed with HTTP 401 (`UNAUTHORIZED_READER`).

### Option A: HMAC-SHA256 Signature (Recommended)
Attach the hex-encoded HMAC-SHA256 signature of the **raw UTF-8 HTTP request body** using the reader's provisioning secret:

```http
x-zebra-signature: <hex_hmac_sha256_of_raw_body>
```
*(Aliases supported: `x-reader-signature`, `x-hub-signature-256`, `x-signature`)*

### Option B: HTTPS Bearer Token Fallback
```http
Authorization: Bearer <reader_provisioning_secret>
```

---

## 4. End-to-End Operational Lifecycle

```
[1. Admin Badge Enrollment]
    Admin/Operator inputs 24-char EPC hex -> System canonicalizes & stores SHA-256 digest + last-4 digits.
    Raw EPC is discarded immediately; never written to database tables or logs.
          |
          v
[2. Reader Provisioning]
    Admin registers FX9600 (schoolId, deviceId, antenna directions IN/OUT, shared secret).
          |
          v
[3. Student Gate Walk]
    Student walks through antenna beam -> FX9600 IoT Connector pushes JSON batch to /rfid/zebra/reads.
          |
          v
[4. Server Verification & Debounce]
    Server authenticates HMAC -> Debounces duplicates (30s cooldown) -> Validates enrolled class section.
    Auto-binds today's session via assigned teacher -> Marks record PRESENT.
          |
          v
[5. Teacher Review & Finalization]
    Teacher opens Review tab on AttendEase dashboard -> Verifies roll call / manual overrides -> Clicks Finalize.
    Unmarked students transition to ABSENT -> Triggering automated guardian SMS notifications.
```

---

## 5. High-Throughput Gate Rate Limiting & Debounce

- **Portal Burst Rate Limit**: Default `RFID_READER_SCAN_RATE_LIMIT=600` (600 requests/min/reader) to prevent HTTP 429 throttling during 50+ student crowd doorway rushes.
- **Duplicate Walk Debounce**: Configured via `RFID_DUPLICATE_TAP_COOLDOWN_MS=30000` (30s). When multiple antennas read the same EPC badge during a single passage, the first read returns `ACCEPTED` (HTTP 200) and subsequent reads return `DUPLICATE` (HTTP 200) without double-marking or resetting attendance.

---

## 6. Physical Hardware Validation Disclaimer

> [!NOTE]
> Zebra FX9600 integration is implemented and software-tested against documented IoT Connector payload contracts. Physical FX9600 hardware validation is pending and is not implied by CI.
> 
> For on-site commissioning procedures, test cases, and sign-off forms, see [docs/FX9600_HARDWARE_ACCEPTANCE_PACK.md](./FX9600_HARDWARE_ACCEPTANCE_PACK.md).
