# AttendEase OS — Install-and-Forget Boundaries

> **Audience**: School operators, headmasters, district IT coordinators  
> **Purpose**: Honest matrix of what runs automatically versus what requires human action  
> **Last Updated**: 2026-08-18

---

## Overview

AttendEase OS is designed to minimize ongoing operator effort for a school with limited IT staff. However, "install-and-forget" has limits. This document is the authoritative reference for what is truly automatic and what requires human attention.

---

## Section 1: Automatic (No Human Action Required After Installation)

| Function | Frequency | Mechanism | Evidence |
|---|---|---|---|
| Database encrypted backup | Daily at 18:30 (configurable via `BACKUP_CRON`) | `docker/backup-entrypoint.sh` autonomous daemon | `./backups/LATEST_MANIFEST.json` |
| Backup integrity self-test | Every backup | AES decryption + gunzip test before publishing | `backup-entrypoint.sh` line 113 |
| Old backup pruning | Every backup | `find -mtime +RETAIN_DAYS -delete` (default 14 days) | `backupAndRestore.sh` |
| Application health probes | Every 5s | Docker healthcheck on `/api/v1/health` | `docker-compose.yml` |
| Container auto-restart on crash | On failure | `restart: always` policy | `docker-compose.yml` |
| SMS worker heartbeat | Every 30s | Touches `/tmp/worker-heartbeat` | `sms-worker.ts` |
| Rate limiting | Per request | Redis-backed `express-rate-limit` | `server.ts` |
| PostgreSQL RLS enforcement | Every query | Database-level policy | `src/db/migrations/` |
| Monitoring alert evaluation | Every 30s | Prometheus rule engine | `monitoring/` |
| Dead-man heartbeat alert | Continuous | `AlertingPipelineWatchdog` in Prometheus | `monitoring/appliance-alerts.yml` |
| Session expiry | Per session timeout | Express session middleware | `server.ts` |
| TLS certificate auto-renewal | Before expiry | Caddy ACME renewal | `docker/Caddyfile` |

---

## Section 2: Requires One-Time Setup (Human Action at Install)

| Function | Action Required | Where | Priority |
|---|---|---|---|
| **Alert email destination** | Set `ALERT_EMAIL_TO` in `.env` | `.env` + `./bin/attendease repair` | **CRITICAL** — without this, monitoring is silent |
| **Alert webhook (Slack/Teams)** | Set `ALERT_WEBHOOK_URL` in `.env` | `.env` + `./bin/attendease repair` | CRITICAL alternative to email |
| **Off-site backup destination** | Set `R2_*` variables in `.env` | `docs/CLOUDFLARE_R2_SETUP.md` | HIGH — disk failure loses all data |
| **SMTP server** | Set `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` | `.env` | Required for email alerts |
| **School domain + TLS** | Set `SERVER_DOMAIN` in `.env` | `.env` | Required for HTTPS access |
| **SMS provider credentials** | Set `SMS_PROVIDER=dlt` + DLT vars | `.env` | Required for parent notifications |
| **First-run setup wizard** | Navigate to `http://<server>/setup` | Browser | Required before first use |
| **Dead-man heartbeat service** | Register `WATCHDOG_WEBHOOK_URL` at healthchecks.io | `.env` | Detects silently broken alerting |

---

## Section 3: Periodic Human Maintenance Required

| Function | Recommended Frequency | Why | Procedure |
|---|---|---|---|
| **Verify backup integrity** | Monthly | Automated drill runs in CI; production needs manual verification | `./bin/attendease diagnostics` |
| **Run disaster recovery drill** | Every 30 days | Confirms backups are actually restorable to a clean server | `./bin/attendease restore ./backups/<latest>` on a test machine |
| **Review Prometheus alerts** | Weekly | Identifies growing problems before they become outages | `http://127.0.0.1:9090/alerts` |
| **Application update** | When new releases are published | Security patches and bug fixes | `./bin/attendease update` |
| **OS security updates** | Monthly | Ubuntu kernel and system library CVEs | `sudo unattended-upgrades` or `sudo apt-get upgrade` |
| **Check disk space** | Monthly (or via alert) | 14 days of backups + logs can fill small disks | `df -h` / Prometheus alert |
| **Rotate secrets** | Every 90 days or on suspected compromise | Session tokens, backup keys | `./scripts/generate-secrets.sh .env --rotate` |
| **Review audit logs** | As needed for incidents | Attendance overrides, credential changes | App admin panel → Audit Logs |

---

## Section 4: What AttendEase Does NOT Do Automatically

| Function | Why It Cannot Be Automated | Human Procedure |
|---|---|---|
| **OS kernel and package updates** | Would require root outside the container boundary; can break running services | `sudo apt-get update && sudo apt-get upgrade` monthly |
| **SSL certificate renewal on LAN-only setups** | Caddy ACME requires outbound internet and a public DNS name | Manual certificate management for private IP setups |
| **School data backup to a new physical location** | Requires physical media | Export backups to USB quarterly; store off-site |
| **Alert delivery when SMTP or webhook is not configured** | There is no default alert destination | Configure `ALERT_EMAIL_TO` or `ALERT_WEBHOOK_URL` |
| **Student roster CSV import** | New student enrollment is an administrative act | Setup wizard CSV upload; or Admin → Students → Import |
| **RFID badge provisioning** | Requires physical badge and reader | Admin → RFID → Enroll Badge |
| **SMS delivery if DLT registration lapses** | Carrier-side enforcement | Renew DLT registration annually |
| **Disaster recovery if host machine is lost** | Requires a new server | Follow `docs/runbooks/INCIDENT_RUNBOOKS.md` |
| **Application rollback if migrations are irreversible** | Schema changes may be one-way | Restore from pre-update backup: `./bin/attendease restore` |

---

## Section 5: SLA Targets (Best-Effort, Not Guaranteed)

| Metric | Target | Condition |
|---|---|---|
| **RTO** (Recovery Time Objective) | < 30 minutes | Backup exists, same host hardware available |
| **RPO** (Recovery Point Objective) | < 24 hours | Daily backup completed; last backup < 24h old |
| **RFID ingest latency** | < 2s per tap | Normal network conditions |
| **QR sync latency** | < 5s after reconnect | Pending queue < 500 records |
| **SMS delivery** | Provider-dependent | DLT credentials configured and valid |

These are engineering targets. Production SLA guarantees require a formal support agreement.

---

## Section 6: Disaster Recovery Runbook (Host Lost)

If the original server is permanently unavailable:

1. **Provision a new Ubuntu 22.04/24.04 server** with the same minimum specs (2 GB RAM, 20 GB disk)
2. **Clone the repository**: `git clone https://github.com/Kh3rwa1/offline-qr-school-attendance.git /opt/attendease`
3. **Copy your `.env` file** from a secure backup location to `/opt/attendease/.env`
4. **Run the installer**: `cd /opt/attendease && ./scripts/install.sh install -y`
5. **Restore the database**:
   ```bash
   # Copy your latest encrypted backup to the new server
   scp old-server:/opt/attendease/backups/attendease-<latest>.sql.gz.enc /opt/attendease/backups/
   ./bin/attendease restore ./backups/attendease-<latest>.sql.gz.enc -y
   ```
6. **Verify health**: `./bin/attendease status`
7. **Update DNS** to point to the new server IP if applicable

---

## Section 7: Operator Responsibility Matrix

| Category | Automatic | Operator | External Party |
|---|---|---|---|
| Application security patches | ✅ `./bin/attendease update` | Triggers update | — |
| OS security patches | — | ✅ `apt upgrade` | — |
| Backup creation | ✅ Daily | Verifies monthly | — |
| Off-site replication | ✅ When configured | Configures R2/S3 | — |
| Alert delivery | ✅ When destinations set | ✅ Configures destinations | — |
| Hardware commissioning | — | — | ✅ Hardware integrator |
| DLT SMS registration | — | — | ✅ School admin + telecom |
| Screen-reader UAT | — | — | ✅ Accessibility specialist |
| Government submission | — | ✅ Downloads report | ✅ Education authority |
| Incident response | Alert fires | ✅ Follows runbook | — |
| Data export requests | — | ✅ Admin panel | — |
| RFID badge enrollment | — | ✅ Admin panel | — |
