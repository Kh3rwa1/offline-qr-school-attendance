# RFID Hardware Compatibility

## Supported Card Technologies
### SECURE Mode
- MIFARE DESFire EV2
- MIFARE DESFire EV3
- JCOP Cards

### UID_LEGACY Mode
- MIFARE Classic 1K/4K
- MIFARE Ultralight
- NTAG 213/215/216

## Supported Reader Types
1. **PCSC Readers:** ACR122U, ACR1252U, HID iCLASS SE.
2. **Network Readers:** HID Signo, Suprema (via OSDP/Network).
3. **USB HID/Keyboard Wedge:** Supported for prototype/legacy integration only.
4. **Web Serial:** Supported in modern browsers for enrollment.

## Hardware Certification Matrix
| Reader Model | SECURE Mode | UID_LEGACY Mode | Interface | OS Support |
| --- | --- | --- | --- | --- |
| ACR1252U | Yes | Yes | USB PC/SC | Win, Mac, Linux |
| HID Signo | Yes | No | OSDP/IP | Independent |
| Generic Wedge| No | Yes | USB HID | Win, Mac, Linux |

## Minimum Requirements
- **SECURE Mode:** Reader must support APDU commands and ISO 14443-4.
- **Firmware:** Latest vendor firmware recommended to patch known PCSC vulnerabilities.
- **OS Compatibility:** Windows 10+, macOS 12+, Ubuntu 20.04+.

## Extending Support
New readers can be supported by implementing the `ReaderAdapter` interface in the Gateway. Business logic remains untouched on the Server.
