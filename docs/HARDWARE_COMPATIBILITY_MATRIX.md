# Hardware Compatibility & Reader Adapter Matrix

| Reader Model | Interface / Connection | Protocol / Capability | Adapter Class | Status | Certification Note |
|---|---|---|---|---|---|
| ACS ACR1252U | USB HID / PC/SC | ISO 14443-A, MIFARE DESFire EV2/EV3, AES-128 | `PcscAdapter` / `GatewayAdapter` | Driver Implemented | Simulator Tested in CI; Hardware Required for Physical Gate |
| ACS ACR122U | USB HID / PC/SC | ISO 14443-A, MIFARE Classic (UID Mode) | `PcscAdapter` / `UsbHidAdapter` | Driver Implemented | Simulator Tested in CI; Hardware Required for Physical Gate |
| Identiv uTrust 3700 F | USB PC/SC | ISO 14443, MIFARE DESFire EV2 | `PcscAdapter` | Driver Implemented | Simulator Tested in CI; Hardware Required for Physical Gate |
| Web Serial RFID Terminal | WebSerial API | Serial ASCII / HEX APDU | `WebSerialAdapter` | Driver Implemented | Kiosk Browser Mode |
| Network IP RFID Gateway | Ethernet / Wi-Fi TCP | TLS 1.3 JSON Stream | `NetworkAdapter` | Driver Implemented | Edge TCP Gateway |

## Cryptographic Features Supported
- RFC 4493 AES-128-CMAC Known-Answer Test Vectors
- AN10922 AES Key Diversification
- DESFire EV2/EV3 3-Pass Mutual Authentication & Challenge Response
- Card-Originated Cryptogram Evidence Verification
- Monotonic Sequence Enforcement

## Hardware Certification Requirements
To achieve **Production Certified** status, an automated hardware-in-the-loop test run on a physical runner with connected USB ACR122U/ACR1252U readers and physical DESFire cards must generate a signed certification artifact containing:
- Reader Manufacturer & Exact Model
- Hardware Serial Number / Redacted Identifiers
- Operating System & PC/SC Driver Version
- DESFire Card Model & Application Configuration
- Git Commit SHA
- Measured Latency & Success/Failure Counts
- Sanitized APDU Transcript
