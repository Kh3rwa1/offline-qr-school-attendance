# Hardware Compatibility & Reader Adapter Matrix

| Reader Model | Interface / Connection | Protocol / Capability | Adapter Class | Status | Certification Note |
|---|---|---|---|---|---|
| ACS ACR1252U | USB HID / PC/SC | ISO 14443-A, MIFARE DESFire EV2/EV3, AES-128 | `PcscAdapter` / `GatewayAdapter` | Certified | Production Hardware Driver |
| ACS ACR122U | USB HID / PC/SC | ISO 14443-A, MIFARE Classic (UID Mode) | `PcscAdapter` / `UsbHidAdapter` | Certified | Legacy UID / DESFire compatible |
| Identiv uTrust 3700 F | USB PC/SC | ISO 14443, MIFARE DESFire EV2 | `PcscAdapter` | Certified | Industrial Edge Reader |
| Web Serial RFID Terminal | WebSerial API | Serial ASCII / HEX APDU | `WebSerialAdapter` | Certified | Browser kiosk mode |
| Network IP RFID Gateway | Ethernet / Wi-Fi TCP | TLS 1.3 JSON Stream | `NetworkAdapter` | Certified | Multi-lane gate system |

## Cryptographic Features Supported
- AN10922 AES Key Diversification
- DESFire EV2 3-Pass Mutual Authentication
- HMAC-SHA256 Transaction Proof Verification
- Monotonic Sequence Enforcement
