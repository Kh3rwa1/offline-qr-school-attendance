# Production Operations Incident Runbooks

## Runbook 1: PostgreSQL Outage & Connection Recovery

### Impact
Database queries fail, returning HTTP 503 Service Unavailable.

### Escalation & Triage
1. Check process liveness and database connection gauge `app_postgres_up`.
2. Inspect container logs:
   ```bash
   docker compose logs db --no-color | tail -n 100
   ```
3. Check pod status in Kubernetes:
   ```bash
   kubectl get pods -l app=school-attendance
   ```

### Remediation
- **Connection Pool Exhaustion**: Restart web pods or increase `POSTGRES_MAX_CONNECTIONS`.
- **Failover / Disaster Recovery**: Execute `./scripts/backupAndRestore.sh` to restore to fresh failover instance if primary storage is unrecoverable.

---

## Runbook 2: Redis Connection Loss / Rate Limiting Degraded

### Impact
Rate-limiting falls back to HTTP 503 or in-memory limiter in non-production.

### Remediation
1. Inspect Redis container logs:
   ```bash
   docker compose logs redis --no-color
   ```
2. Verify Redis memory usage:
   ```bash
   redis-cli -h 127.0.0.1 info memory
   ```
3. Restart Redis service container:
   ```bash
   docker compose restart redis
   ```

---

## Runbook 3: SMS Notification Backlog

### Impact
Parents do not receive absence notifications within expected SLAs.

### Remediation
1. Verify `sms-worker` pod status and heartbeats.
2. Check DLT credentials & SMS provider gateway status.
3. Scale `sms-worker` deployment replicas:
   ```bash
   kubectl scale deployment school-attendance-worker --replicas=5
   ```

---

## Runbook 4: Encrypted Backup & Restore Procedure

### Procedure
1. Set backup passphrase environment variable:
   ```bash
   export BACKUP_PASSPHRASE="your-secure-passphrase"
   ```
2. Run backup script:
   ```bash
   ./scripts/backupAndRestore.sh
   ```
3. Verify target database row counts and tenant RLS policies post-restore.
