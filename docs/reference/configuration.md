---
title: "Configuration Reference"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# Configuration Reference

Environment variables and configuration schema automatically generated from `src/env.ts`.
To update this reference or `.env.example`, edit `src/env.ts` and run `npm run gen:env`.

| Variable | Group | Description | Secret | Default / Example |
|---|---|---|---|---|
| `NODE_ENV` | Server & Process | Application runtime environment (development, test, production) | no | `production` |
| `COMPONENT` | Server & Process | Process role to execute (web, worker, migrate) | no | `web` |
| `PORT` | Server & Process | HTTP server listening port | no | `3000` |
| `APP_URL` | Server & Process | Canonical public base URL of the AttendEase web portal | no | `http://localhost:3000` |
| `LOG_LEVEL` | Server & Process | Pino structured logging level (fatal, error, warn, info, debug, trace) | no | `info` |
| `WEB_REPLICA_COUNT` | Server & Process | Number of active web application replicas running behind proxy | no | `2` |
| `SHUTDOWN_DRAIN_MS` | Server & Process | Timeout in ms to wait for in-flight requests to complete during SIGTERM drain | no | `20000` |
| `SHUTDOWN_READINESS_GRACE_MS` | Server & Process | Delay in ms between unmarking readiness check and closing server listeners | no | `3000` |
| `DATABASE_URL` | Database & Connection Pools | PostgreSQL connection URL for school tenant operations (RLS enforced) | no | `postgres://attendease_app:password@localhost:5432/attendease` |
| `SYSTEM_DATABASE_URL` | Database & Connection Pools | PostgreSQL connection URL for system/migration operations (must be isolated role) | no | `postgres://attendease_sys:password@localhost:5432/attendease` |
| `AUTH_DATABASE_URL` | Database & Connection Pools | PostgreSQL connection URL for authentication and credential verification | no | `postgres://attendease_auth:password@localhost:5432/attendease` |
| `PG_APPLICATION_NAME` | Database & Connection Pools | Custom application_name tag sent to PostgreSQL for connection identification | no | `attendease-web` |
| `PG_POOL_MIN` | Database & Connection Pools | Minimum idle connections maintained per pool | no | `2` |
| `PG_POOL_MAX` | Database & Connection Pools | Fallback global maximum pool size override | no | `20` |
| `PG_POOL_MAX_APP` | Database & Connection Pools | Maximum database connections dedicated to tenant app pool | no | `10` |
| `PG_POOL_MAX_SYS` | Database & Connection Pools | Maximum database connections dedicated to system/maintenance pool | no | `5` |
| `PG_IDLE_TIMEOUT_MS` | Database & Connection Pools | Milliseconds an idle connection can remain open before being closed | no | `30000` |
| `PG_CONNECTION_TIMEOUT_MS` | Database & Connection Pools | Milliseconds to wait before timing out while acquiring a connection from the pool | no | `5000` |
| `PG_STATEMENT_TIMEOUT_MS` | Database & Connection Pools | PostgreSQL statement timeout limit in milliseconds per query | no | `10000` |
| `PG_IDLE_IN_TRANSACTION_TIMEOUT_MS` | Database & Connection Pools | PostgreSQL idle_in_transaction_session_timeout in milliseconds | no | `5000` |
| `MAX_ALLOWED_DB_CONNECTIONS` | Database & Connection Pools | Cluster-wide safety cap on total allowed database connections | no | `100` |
| `REDIS_URL` | Redis Cache & Rate Limiting | Full connection URL for Redis cache and rate limiting service | no | `redis://localhost:6379` |
| `REDIS_HOST` | Redis Cache & Rate Limiting | Redis hostname when not using REDIS_URL | no | `localhost` |
| `REDIS_PORT` | Redis Cache & Rate Limiting | Redis TCP port when not using REDIS_URL | no | `6379` |
| `REDIS_PASSWORD` | Redis Cache & Rate Limiting | Redis password authentication credential | yes | *(generated)* |
| `REDIS_KEY_HMAC_SECRET` | Redis Cache & Rate Limiting | HMAC key used to hash student identifiers in Redis cache keys | yes | *(generated)* |
| `SESSION_SECRET` | Session & Security | HMAC secret key used to sign and encrypt session cookies (min 32 chars) | yes | *(generated)* |
| `CSRF_SECRET` | Session & Security | HMAC key used for CSRF double-submit token verification (min 32 chars) | yes | *(generated)* |
| `TRUSTED_INGRESS_SECRET` | Session & Security | Shared secret verified on incoming reverse proxy forwarded headers | yes | *(generated)* |
| `ALLOW_TEST_BYPASS` | Session & Security | Allow bypassing auth checks for local testing (STRICTLY FORBIDDEN in production) | no | `false` |
| `FEATURE_RFID` | UHF RFID Gate Ingest | Enable UHF RFID reader endpoints and background ingest services | no | `true` |
| `RFID_INGEST_V2` | UHF RFID Gate Ingest | Enable high-throughput batch ingest pipeline with transaction batching | no | `true` |
| `LEGACY_READER_BEARER_FALLBACK` | UHF RFID Gate Ingest | Allow transitional fallback for legacy reader bearer token authentication | no | `false` |
| `READER_TOKEN_PEPPER` | UHF RFID Gate Ingest | Server-side cryptographic pepper used when hashing reader bearer tokens at rest | yes | *(generated)* |
| `RFID_CREDENTIAL_DIGEST_KEY` | UHF RFID Gate Ingest | HMAC secret key used to compute irreversible EPC badge credential digests | yes | *(generated)* |
| `RFID_HMAC_SECRET` | UHF RFID Gate Ingest | Shared secret for verifying reader HTTP webhook HMAC-SHA256 signatures | yes | *(generated)* |
| `RFID_HMAC_KEY_VERSION` | UHF RFID Gate Ingest | Key version identifier for active RFID HMAC secret | no | `1` |
| `RFID_DUPLICATE_TAP_COOLDOWN_MS` | UHF RFID Gate Ingest | Debounce window in milliseconds to suppress rapid duplicate badge reads | no | `30000` |
| `RFID_MAX_CLOCK_SKEW_MS` | UHF RFID Gate Ingest | Maximum tolerated clock skew in ms between reader and server timestamps | no | `30000` |
| `RFID_MAX_OFFLINE_DURATION_HOURS` | UHF RFID Gate Ingest | Maximum tolerated reader offline operation buffer duration in hours | no | `24` |
| `RFID_MAX_ROSTER_AGE_HOURS` | UHF RFID Gate Ingest | Maximum allowable age of local edge roster cache in hours | no | `4` |
| `RFID_OFFLINE_QUEUE_CAPACITY` | UHF RFID Gate Ingest | Maximum capacity of offline scan event buffer queue | no | `10000` |
| `RFID_OFFLINE_FAIL_MODE` | UHF RFID Gate Ingest | Queue full failure policy (OPEN or CLOSED) | no | `CLOSED` |
| `RFID_READER_SCAN_RATE_LIMIT` | UHF RFID Gate Ingest | Maximum scans per minute permitted from a single reader | no | `600` |
| `RFID_CARD_MASTER_KEY` | UHF RFID Gate Ingest | Master key for reader credential signature verification | yes | *(generated)* |
| `RFID_REQUIRE_CARD_PROOF` | UHF RFID Gate Ingest | Enforce cryptographic proof in incoming tag read events | no | `false` |
| `ALLOW_LEGACY_RFID_UID_MODE` | UHF RFID Gate Ingest | Allow legacy unhashed card UID mode (deprecated) | no | `false` |
| `RFID_GATEWAY_URL` | UHF RFID Gate Ingest | URL of internal hardware gateway relay if deployed | no | `http://localhost:4000` |
| `RFID_OUTBOX_ENCRYPTION_KEY` | UHF RFID Gate Ingest | Symmetric encryption key for local offline scan event store | yes | *(generated)* |
| `RFID_READER_ID` | UHF RFID Gate Ingest | Default identifier assigned to local hardware reader | no | `reader-gate-01` |
| `SCHOOL_ID` | UHF RFID Gate Ingest | Default school UUID identifier for single-tenant appliance deployment | no | `00000000-0000-0000-0000-000000000000` |
| `KMS_MASTER_KEY` | KMS & Envelope Encryption | Master 256-bit encryption key used by local KMS provider | yes | *(generated)* |
| `AWS_KMS_KEY_ARN` | KMS & Envelope Encryption | AWS KMS Key ARN for cloud-managed envelope encryption | no | `arn:aws:kms:ap-south-1:123456789012:key/example-key` |
| `GCP_KMS_RESOURCE_ID` | KMS & Envelope Encryption | Google Cloud KMS Key Resource ID for cloud-managed envelope encryption | no | `projects/p/locations/l/keyRings/r/cryptoKeys/k` |
| `METRICS_AUTH_TOKEN` | Telemetry & Alerting | Bearer authentication token required to scrape Prometheus /metrics | yes | *(generated)* |
| `ALERT_WEBHOOK_URL` | Telemetry & Alerting | HTTP webhook URL for dispatching urgent operational failure alerts | no | `https://alerts.example.com/webhook` |
| `SMS_PROVIDER` | DLT SMS & Telecom Integration | Active SMS dispatch engine implementation (fake, console, dlt) | no | `console` |
| `SMS_WEBHOOK_SECRET` | DLT SMS & Telecom Integration | HMAC secret for verifying inbound carrier delivery receipts | yes | *(generated)* |
| `SMS_GATEWAY_URL` | DLT SMS & Telecom Integration | HTTP endpoint of telecom SMS gateway provider | no | `https://sms.example.com/send` |
| `SMS_WORKER_INTERVAL_MS` | DLT SMS & Telecom Integration | Queue poll interval in milliseconds for background SMS worker | no | `5000` |
| `SMS_WORKER_REPLICA_COUNT` | DLT SMS & Telecom Integration | Number of SMS background worker processes running | no | `2` |
| `DLT_SMS_API_KEY` | DLT SMS & Telecom Integration | API authorization key for Indian Telecom DLT gateway provider | yes | *(generated)* |
| `DLT_SMS_SENDER_ID` | DLT SMS & Telecom Integration | Approved 6-character TRAI DLT Header / Sender ID | no | `SCHATT` |
| `DLT_SMS_ENTITY_ID` | DLT SMS & Telecom Integration | Registered Principal Entity ID on TRAI DLT portal | no | `1201159000000000000` |
| `DLT_SMS_BASE_URL` | DLT SMS & Telecom Integration | Base API URL for TRAI DLT telecom messaging gateway | no | `https://api.sms-provider.in/v1` |
| `DLT_SMS_HEADER` | DLT SMS & Telecom Integration | Custom header required by DLT SMS provider | no | `X-DLT-Header` |
| `DLT_WEBHOOK_SECRET` | DLT SMS & Telecom Integration | Secret key for verifying DLT delivery status callback webhooks | yes | *(generated)* |
| `DLT_PRINCIPAL_ENTITY_ID` | DLT SMS & Telecom Integration | Principal entity ID alias for secondary DLT configuration | no | `1201159000000000000` |
| `DLT_SMS_GATEWAY_URL` | DLT SMS & Telecom Integration | Direct API URL for DLT message dispatch endpoint | no | `https://api.sms-provider.in/v1/send` |
| `DLT_SMS_WEBHOOK_SECRET` | DLT SMS & Telecom Integration | Direct webhook signature secret for DLT callbacks | yes | *(generated)* |
| `BACKUP_DIR` | Backups & Disaster Recovery | Local filesystem directory path for encrypted database backups | no | `/var/backups/attendease` |
| `BACKUP_ENCRYPTION_KEY` | Backups & Disaster Recovery | Age recipient public key or passphrase for database backup encryption | yes | *(generated)* |
| `LATEST_BACKUP_TIMESTAMP` | Backups & Disaster Recovery | Timestamp of latest verified successful backup drill | no | `2026-10-06T00:00:00Z` |
| `WORKER_HEARTBEAT_FILE` | Backups & Disaster Recovery | Filesystem path touched periodically by workers for liveness checks | no | `/tmp/worker-heartbeat` |
| `R2_ACCOUNT_ID` | Backups & Disaster Recovery | Cloudflare Account ID for offsite R2 replication storage | no | `cf-account-id` |
| `R2_ACCESS_KEY_ID` | Backups & Disaster Recovery | Cloudflare R2 S3-compatible Access Key ID | no | `r2-access-key-id` |
| `R2_SECRET_ACCESS_KEY` | Backups & Disaster Recovery | Cloudflare R2 S3-compatible Secret Access Key | yes | *(generated)* |
| `R2_BUCKET` | Backups & Disaster Recovery | Cloudflare R2 bucket name for encrypted backup archives | no | `attendease-backups` |
| `R2_ENDPOINT` | Backups & Disaster Recovery | S3-compatible endpoint URL for Cloudflare R2 bucket | no | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_PREFIX` | Backups & Disaster Recovery | Key prefix / folder within Cloudflare R2 bucket | no | `backups/school-01` |
| `R2_JURISDICTION` | Backups & Disaster Recovery | Cloudflare R2 data storage jurisdiction (e.g., in, eu) | no | `in` |
| `R2_RETENTION_DAYS` | Backups & Disaster Recovery | Days to retain backup archives in Cloudflare R2 storage | no | `90` |
| `R2_UPLOAD_TIMEOUT_SECONDS` | Backups & Disaster Recovery | Timeout in seconds for R2 backup archive upload operations | no | `300` |
| `R2_MAX_RETRIES` | Backups & Disaster Recovery | Maximum retry attempts for failed R2 backup uploads | no | `3` |
| `REPORT_ARTIFACT_MAX_BYTES` | Reporting Engine | Maximum byte size allowed for a generated report file | no | `52428800` |
| `REPORT_ARTIFACT_STORAGE` | Reporting Engine | Storage backend for report files (local or object) | no | `local` |
| `REPORT_ARTIFACT_DIR` | Reporting Engine | Directory path for storing generated report files | no | `/var/data/reports` |
| `REPORT_GENERATION_CONCURRENCY` | Reporting Engine | Maximum concurrent background report generation tasks | no | `2` |
| `REPORT_GENERATION_MAX_PENDING` | Reporting Engine | Maximum pending report requests allowed in queue | no | `10` |
| `REPORT_MAX_ESTIMATED_CELLS` | Reporting Engine | Upper threshold of spreadsheet cells to avoid memory exhaustion | no | `1000000` |
| `REPORT_MAX_PERIOD_DAYS` | Reporting Engine | Maximum date span in days for a single attendance report | no | `365` |
| `REPORT_MAX_STUDENTS` | Reporting Engine | Maximum student count processed in a single report generation task | no | `5000` |
| `CI` | Testing & Development Runtime | Flag indicating execution inside automated continuous integration environment | no | `true` |
| `TEST_SERVER_STATIC` | Testing & Development Runtime | Serve built static frontend bundle in test environment | no | `true` |
| `RUN_SERVER` | Testing & Development Runtime | Start HTTP server listener automatically upon module execution | no | `true` |
| `VITEST` | Testing & Development Runtime | Flag indicating execution within the Vitest test runner | no | `true` |
