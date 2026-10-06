---
title: "Appliance Upgrades and Migrations"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# Appliance Upgrades and Migrations

Operational guidelines and runbooks for executing major version upgrades of AttendEase OS appliances.

## Upgrading 1.x → 2.0.0 (allow 60 min, outside school hours)

Executing a major upgrade involves changes to the backup encryption cipher, reader authentication schemes, and database tenant isolation policies. Perform this upgrade outside instructional gate hours.

1. **Create legacy snapshot**:
   ```bash
   ./bin/attendease backup
   ```
   This creates the final legacy-format (`.sql.gz.enc`) backup archive. Keep this file in secure storage for emergency rollback.

2. **Pull and deploy release**:
   ```bash
   git fetch && git checkout v2.0.0 && ./bin/attendease update
   ```
   The installer automatically pulls the `v2.0.0` container images, applies database schema migrations, and provisions local Ed25519 signing keys and age recipient public keys.

3. **Secure offline backup identity**:
   ```bash
   # Copy private key to secure offline external storage
   cp secrets/backup/age-identity.txt /media/usb-secure/
   ```
   **Copy `secrets/backup/age-identity.txt` to offline storage immediately.** Loss of this key prevents disaster recovery decryption.

4. **Rotate reader bearer tokens**:
   For each physical Zebra FX9600 reader:
   - Navigate to **Admin → Readers**.
   - Click **Rotate Token**.
   - Copy the new bearer token and paste it into the Zebra IoT Connector cloud/HTTP client configuration.
   - Verify green "Last seen" telemetry in the reader status table.

5. **Monitor transitional bearer fallback**:
   Inspect appliance logs to confirm all readers have transitioned:
   ```bash
   docker compose logs -f app | grep "LEGACY_READER_AUTH_USED"
   ```
   Once the warning logs stop, disable transitional fallback by configuring `.env`:
   ```env
   LEGACY_READER_BEARER_FALLBACK=false
   ```
   and restart services with `./bin/attendease repair`.

6. **Rotate reader HMAC secrets**:
   Rotate every reader's HMAC shared secret key (in v1.x HMAC keys could be accepted as bearer tokens; v2.0.0 enforces strict cryptographic separation).

7. **Execute restore dry-run verification drill**:
   ```bash
   ./bin/attendease backup
   ./bin/attendease restore --dry-run ./backups/backup-<timestamp>.dump.age
   ```
   The `--dry-run` flag decrypts the age archive and validates archive integrity and digital signatures without altering the running PostgreSQL database.

---

## Breaking Changes in v2.0.0

- **Backup Cipher Upgrade**: Backups use authenticated `age` encryption (X25519-ChaCha20Poly1305) with Ed25519 manifest digital signatures.
- **Reader Token Hashing**: Reader bearer tokens are hashed with a cryptographic pepper (`READER_TOKEN_PEPPER`) at rest.
- **Retired PC/SC Smartcard Endpoints**: Deprecated `/rfid/scans` route and PC/SC libraries removed ([ADR-006](file:///Users/dulorai/Documents/offline-qr-school-attendance/docs/explanation/ADR-006-retire-pcsc-desfire.md)).
- **Privacy-First Ingest Payloads**: Webhook responses return decision codes and opaque token digests without student names.
- **Strict URL Tenant Scoping**: Tenant context requires URL `:schoolId`. Header and body tenant scoping parameters are rejected.

---

## Rollback Procedure

If operational failures occur during the upgrade window:

```bash
./bin/attendease rollback
```

`./bin/attendease rollback` restores the recorded 1.x container image stack.  
**Critical Note**: Version 1.x **cannot** read or restore 2.0 `age` backup archives. If rolling back database state, restore using the step-1 legacy backup file created prior to update.
