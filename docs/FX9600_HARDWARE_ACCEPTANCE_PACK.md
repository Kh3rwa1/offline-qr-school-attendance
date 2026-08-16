# Zebra FX9600 Physical Hardware Validation Runbook & Acceptance Pack

> [!IMPORTANT]
> **Production Certification Policy**: Software integration is verified against documented Zebra IoT Connector JSON contracts in CI. A final verdict of **`10/10 PHYSICALLY VALIDATED`** is granted only when on-site human physical validation with live hardware is executed and submitted using this acceptance pack.

---

## 1. On-Site Physical Commissioning Procedure

### Pre-Requisites
1. **Zebra FX9600 Fixed Reader**: India/ETSI SKU (865–867 MHz), 4-port or 8-port.
2. **Antenna Array**: Circularly polarized UHF patch antennas mounted at entrance doorway (e.g., Port 1 Entry, Port 2 Exit).
3. **Power & Network**: PoE+ switch or AC power supply; static Ethernet LAN IP on same network as AttendEase appliance.
4. **Passive UHF Tags**: EPC Class 1 Gen 2 / ISO 18000-63 inlays or cards.
5. **AttendEase Server**: Active instance with `FEATURE_RFID=true` and provisioned reader secret.

### Reader Configuration Steps
1. Navigate to Zebra FX9600 Web Console (`https://<reader-ip>`).
2. Set Region / Operating Frequency: **India (865.0 – 867.0 MHz)**.
3. Configure **IoT Connector Profile**:
   - **Endpoint Type**: HTTP / HTTPS Webhook
   - **URL**: `https://<attendease-ip>/api/v1/schools/<school-id>/rfid/zebra/reads`
   - **Event Filter**: Tag Read Events + Keepalive Heartbeats
   - **Authentication**: Custom Header `x-zebra-signature: <hmac-sha256>` or `Authorization: Bearer <secret>`
   - **Transmit Power**: Calibrated to doorway aperture (e.g., 27.0 dBm to 30.0 dBm).
4. Save configuration and start reader read session.

---

## 2. Hardware Acceptance Verification Checklist

| Step | Test Flow | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :---: |
| **T1: Single Enrolled Walk** | Student with enrolled badge walks through antenna beam | HTTP 200 `ACCEPTED`, 1 PRESENT record created | [ ] |
| **T2: Debounce Cooldown** | Student lingers or re-walks within 30s | HTTP 200 `DUPLICATE`, 0 extra records created | [ ] |
| **T3: Unknown Badge** | Unenrolled EPC tag walks through gate | HTTP 200 `UNKNOWN_CARD`, 0 attendance records | [ ] |
| **T4: Revoked Badge** | Revoked EPC tag walks through gate | HTTP 200 `REVOKED_CARD`, 0 attendance records | [ ] |
| **T5: Doorway Crowd Rush** | 10+ students walk simultaneously (>200 reads/min) | All enrolled marked PRESENT, 0 HTTP 429 throttles | [ ] |
| **T6: Teacher Review** | Teacher opens AttendEase dashboard | Real-time roll matches physical gate entries | [ ] |
| **T7: Session Finalization** | Teacher finalizes session | Remaining UNMARKED convert to ABSENT, SMS queued | [ ] |

---

## 3. Physical Evidence Submission Template

*Operators must fill out this template and archive it in site deployment records without logging raw EPC values or plain secrets.*

```markdown
### Zebra FX9600 On-Site Hardware Certification Sign-Off

- **School Name**: [e.g. Model High School, Purulia]
- **School ID (Sanitized)**: [UUID prefix, e.g. 5b12...-xxxx]
- **Date & Time of Drill**: [YYYY-MM-DD HH:MM IST]
- **Software Release SHA**: [git commit hash]
- **Zebra FX9600 Serial**: [Sanitized, e.g. FX9600-XXXX-2026]
- **Firmware Version**: [e.g. 3.10.30.0]
- **IoT Connector Version**: [e.g. 2.1.0]
- **Antenna Model & Ports**: [e.g. Zebra AN480 on Ports 1 & 2]
- **Regulatory Frequency**: ETSI / India 865–867 MHz

#### Validation Results Summary:
1. Webhook HMAC Authenticated: [YES / NO]
2. Total Students Processed: [Count]
3. Exactly One Attendance Record per Student: [VERIFIED via DB query]
4. Duplicate Debounce Filtered: [VERIFIED]
5. Guardian Absence SMS Dispatched on Finalization: [VERIFIED]

#### Commissioning Engineer / Administrator Sign-Off:
- **Name**: 
- **Designation**: 
- **Signature**: 
- **Date**: 
```
