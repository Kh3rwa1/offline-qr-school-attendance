# Off-site Backups & Alert Delivery

This appliance already survives power cuts, reboots and crashes on its own. Two
things it could **not** previously survive without a human:

1. **A dead, stolen or flooded disk** - backups were written to the same machine
   as the database.
2. **A silent failure** - alert rules existed in `./monitoring`, but nothing
   evaluated them and nobody was notified.

This document covers both.

---

## 1. Off-site encrypted backups

### What happens automatically

The `backup` container already produces a nightly AES-256-CBC encrypted dump
(default 18:30), verifies it can be decrypted, writes a SHA-256 manifest, and
prunes snapshots older than `BACKUP_RETAIN_DAYS`.

Once off-site replication is configured, each verified snapshot is **also**
uploaded to an S3-compatible bucket and confirmed present remotely before the
run is considered successful.

- Objects are stored as `<prefix>/<year>/<month>/attendease-<timestamp>.sql.gz.enc`
- The `.manifest.json` sidecar is uploaded alongside it
- Uploads retry 3 times with increasing backoff (slow rural links are expected)
- Files are **encrypted before they leave the building**, so the storage
  provider never sees student data

### Configuration

Any S3-compatible provider works - Cloudflare R2, Amazon S3, Backblaze B2,
Wasabi, or a MinIO box at the district office. Set these in `.env`:

```env
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="attendease-backups"
```

For Cloudflare R2, the endpoint is derived from the account id automatically.
For any other provider, set `R2_ENDPOINT` explicitly and set the region:

```env
R2_ENDPOINT="https://s3.eu-central-003.backblazeb2.com"
OFFSITE_BACKUP_REGION="eu-central-003"
```

Then restart the backup service:

```bash
docker compose up -d backup
```

> **Keep `BACKUP_ENCRYPTION_KEY` somewhere other than the appliance.** The
> off-site copies are useless without it. Store it in a password manager or a
> sealed envelope in the school safe. This is the single most important manual
> step in the whole system.

### Verifying it works

```bash
# Trigger an immediate backup + replication cycle
docker compose exec backup /bin/sh /backup-entrypoint.sh --run-once

# Check the result
docker compose exec backup cat /backups/OFFSITE_STATUS
```

`OFFSITE_STATUS` contains one of:

| State | Meaning |
|---|---|
| `SUCCESS <time> <bucket/key> <size> <sha256>` | Verified off-site |
| `DISABLED <time> ...` | Not configured; local backups only |
| `FAILED <time> <reason>` | Configured but the upload failed |

### How you find out when it breaks

The `backup` container's healthcheck reports **unhealthy** when off-site
replication is configured but the newest verified upload is older than
`OFFSITE_MAX_AGE_HOURS` (default 48). That surfaces in:

```bash
docker ps                      # STATUS column shows (unhealthy)
./scripts/install.sh status
```

If you also enable the monitoring profile below, container health becomes a
notification instead of something you have to look for.

### Restoring from an off-site copy

```bash
# 1. Download the archive from your bucket (any S3 client or the web console)
# 2. Verify integrity against the manifest
sha256sum attendease-20260818-183000.sql.gz.enc

# 3. Restore
./scripts/install.sh restore ./attendease-20260818-183000.sql.gz.enc
```

---

## 2. Alert delivery

### Starting the monitoring stack

Monitoring is an opt-in profile so the base stack stays small:

```bash
docker compose --profile monitoring up -d
```

This starts Prometheus (evaluates the rules in `./monitoring`) and Alertmanager
(delivers notifications). Both bind to `127.0.0.1` only and are never exposed to
the school network.

### Choosing where alerts go

Set **at least one** channel in `.env`, otherwise alerts are recorded but nobody
is told. The Alertmanager container logs a loud warning if none is configured.

**Email:**

```env
ALERT_EMAIL_TO="headmaster@school.example.in,it-support@district.example.in"
ALERT_EMAIL_FROM="attendease@school.example.in"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USERNAME="attendease@school.example.in"
SMTP_PASSWORD="app-specific-password"
```

**Webhook** (Slack, Google Chat, Telegram bridge, district dashboard):

```env
ALERT_WEBHOOK_URL="https://hooks.example.com/services/XXX"
```

### The dead-man's switch

A broken alerting pipeline is invisible - no alerts looks exactly like nothing
being wrong. `AlertingPipelineWatchdog` fires continuously by design and is
routed to a separate heartbeat receiver. Point it at a free service such as
healthchecks.io or Better Stack:

```env
WATCHDOG_WEBHOOK_URL="https://hc-ping.com/your-uuid-here"
```

If those pings stop arriving, that service emails you - **even if the whole
appliance is off**. This is what makes unattended operation trustworthy.

### What you get alerted about

| Alert | Fires when | Severity |
|---|---|---|
| `ApplianceAppDown` | App unreachable for 2 min | critical |
| `PostgresDown` / `RedisDown` | Database or cache connection lost | critical |
| `BackupStale` | Newest backup older than 24 h | critical |
| `BackupVerificationFailed` | Integrity self-test failed | critical |
| `SmsQueueBacklogHigh` | Over 1,000 pending parent SMS | warning |
| `RfidReaderOffline` | A gate reader unseen for 5 min | warning |
| `HighHttpErrorRate` | Over 1% of requests failing | critical |

Critical alerts repeat hourly until resolved; warnings every 6 hours. Tune with
`ALERT_CRITICAL_REPEAT_INTERVAL` and `ALERT_REPEAT_INTERVAL`.

RFID alert rules and the gateway scrape target are only loaded when
`FEATURE_RFID=true`, so QR-only schools never see permanently-firing reader
alarms.

### Checking the pipeline

```bash
# Are rules loaded and targets healthy?
curl -s http://127.0.0.1:9090/api/v1/targets | head -c 400

# What is currently firing?
curl -s http://127.0.0.1:9093/api/v2/alerts | head -c 400
```

---

## 3. What still needs a human

Being honest about the limits of unattended operation:

| Task | Frequency | Why it cannot be automated |
|---|---|---|
| Store `BACKUP_ENCRYPTION_KEY` off the appliance | Once | Encrypted backups are worthless without it |
| Top up SMS provider credit | As needed | External vendor billing |
| Academic year rollover, class promotion | Yearly | Requires school decisions |
| Admissions, transfers, staff changes | Ongoing | Requires human records |
| Reissue lost QR cards / RFID tags | As needed | Physical handover |
| Apply version updates (`./scripts/install.sh update`) | Occasionally | Deliberately manual - unattended upgrades of an attendance system are a worse risk than delayed ones |
| Replace failed RFID reader hardware | Rare | Physical repair |

Everything else - restarts, power cuts, crashes, nightly encrypted backups,
off-site replication, certificate renewal, log rotation, schema migrations -
runs without anyone touching it.
