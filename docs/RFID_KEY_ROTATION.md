# RFID Key Rotation

## Key Version Tracking
All active keys are tracked in the `rfid_key_versions` table. Each card/reader configuration references a specific key version.

## Rotation Procedure
1. Generate new key version.
2. Deploy new keys to Vault/environment.
3. Register new key version in database.
4. Update Readers to accept new key version.
5. New cards are enrolled with the new key version.
6. Old cards are incrementally updated on tap (if supported) or eventually phased out.

## Multi-Version Support
The system seamlessly handles multiple active key versions, attempting authentication against the highest supported version first, falling back as configured.

## Emergency Key Rotation
If a key is compromised:
1. Mark compromised key version as REVOKED.
2. Readers immediately reject credentials using the compromised key.
3. Trigger mass re-enrollment workflow for affected cards.

## Secret Storage
- Keys must be stored in HashiCorp Vault or securely injected via environment variables.
- Raw keys must NEVER be logged or committed to the codebase.
