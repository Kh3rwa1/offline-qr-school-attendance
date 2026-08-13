# RFID Incident Response

## Scenarios & Playbooks

### Lost or Stolen Card
- **Action:** Administrator marks card as REVOKED in dashboard.
- **Impact:** Gateway syncs revocation immediately. Card is permanently invalidated.

### Compromised Reader
- **Action:** Revoke reader's mTLS certificate and mark reader SUSPENDED in database.
- **Impact:** Gateway/Reader cannot connect to server. Investigation required.

### Key Compromise
- **Action:** Emergency Key Rotation (see RFID_KEY_ROTATION.md). Mass re-enrollment required.

### Replay Attack Detected
- **Action:** Redis rate limiter or nonce validator triggers alert.
- **Investigation:** Correlate Gateway logs, check for physical tampering of reader network.

### Mass Card Failure
- **Diagnostic Steps:** Check Gateway connectivity, verify `rfid_key_versions` active status, check reader physical status.

### Cross-Tenant Data Leak
- **Action:** Isolate system, review RLS policies, audit database query logs.
- **Containment:** Block offending API keys/sessions.

## Alerts & Monitoring
Prometheus alerts are configured for:
- High auth failure rate.
- Offline queue approaching capacity.
- Reader heartbeat failure.
