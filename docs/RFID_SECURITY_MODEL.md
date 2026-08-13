# RFID Security Model

## Threat Analysis
- **Card Cloning:** Mitigated in SECURE mode using DESFire EV2/EV3 challenge-response. UID_LEGACY mode is vulnerable to cloning.
- **Reader Spoofing:** Mitigated via mTLS authentication between Gateway and Server.
- **Replay Attacks:** Mitigated via Redis-backed nonce validation.
- **Cross-Tenant Access:** Mitigated via PostgreSQL Row Level Security (RLS).
- **Offline Manipulation:** Mitigated via signed event queues and encrypted local storage.

## Security Modes
### SECURE Mode
- **Technology:** MIFARE DESFire EV2/EV3.
- **Mechanism:** Mutual authentication, diversified keys per card, challenge-response cryptograms.
- **Replay Resistance:** Strong.

### UID_LEGACY Mode
- **Status:** Disabled by default (`ALLOW_LEGACY_RFID_UID_MODE=false`).
- **Mechanism:** HMAC transformation of UID with domain separation.
- **Cloning Risk:** High. UID-only cards can be trivially cloned. This mode is NOT anti-cloning and is provided only for migration or low-security environments.

## Reader Authentication
Readers connect to the Gateway, which connects to the Server using mTLS. Each Gateway has a unique signed client certificate. Compromised certificates can be revoked.

## Credential Storage
- **NEVER STORE RAW UIDs.**
- All UIDs and card identifiers are hashed using HMAC-SHA256 with a system-level secret before storage or comparison.
- Timing-safe comparisons are used to prevent side-channel attacks.

## Key Management
- Versioned keys stored securely (e.g., Vault, encrypted environment variables).
- Seamless key rotation supported via the `rfid_key_versions` table.

## Production Startup Validation
The application refuses to start if security configurations are weak (e.g., legacy mode enabled without explicit override, missing secrets, default keys). No card secrets are ever exposed to the browser.
