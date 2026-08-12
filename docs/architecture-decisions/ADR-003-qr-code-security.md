# ADR-003: QR Code Security and Offline Hash Verification

* **Status:** Approved
* **Date:** 2026-08-11
* **Context:** Physical student QR cards may be lost, copied, or inspected by unauthorized parties. The QR payload must protect student PII while enabling fast offline verification.

## Decision
1. **Opaque Credentials:** Physical QR codes contain only a cryptographically secure 128-bit random secret (`S`). No student names, roll numbers, phone numbers, addresses, or Aadhaar numbers are stored in the QR code.
2. **Offline SHA-256 Digest Matching:** The server stores `SHA-256(S)`. When downloading rosters for offline use, the client receives a lookup dictionary mapping `{ SHA-256(S): studentId }`. Raw secrets `S` are never cached or sent to the client.
3. **Visual Two-Factor Verification:** Upon scanning a valid QR card, the application displays student photo, Bengali/English name, and roll number on screen for immediate visual verification by the teacher.
4. **Revocation Support:** Admin revocation invalidates the token digest on the server and flags it in downloaded lookup dictionaries.

## Consequences
* **Positives:** Total privacy protection for students; lost physical cards reveal zero PII; instant offline credential validation.
* **Negatives:** Cards must be re-printed when credentials are revoked.
