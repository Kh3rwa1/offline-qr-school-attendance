# AttendEase OS

UHF RFID gate attendance for schools, built for the Zebra FX9600. Bilingual (English / বাংলা), self-hosted appliance, with offline QR fallback.

## Subsystem status

<!-- status:start -->
| Subsystem | Status | What that means | Evidence |
|---|---|---|---|
| **Zebra FX9600 ingest** | `Software-verified` | Webhook contract tested against recorded payloads; batched ingest, idempotent, p95 < 300 ms on 4 GB ARM appliance. _Limits: No physical reader commissioning yet; Read rate in real gate conditions unmeasured._ | [test](tests/rfid/zebraIotConnector.test.ts), [load-test](docs/evidence/2026-10-load-test.md) |
| **UHF EPC Credential Vault** | `Software-verified` | Salted SHA-256 EPC digests, HKDF per-reader secret derivation, canonicalized hex representation. _Limits: UHF EPC tags can be read and cloned with inexpensive writers; hashing EPCs at rest does not prevent physical over-the-air tag cloning._ | [test](tests/rfid/rfidCrypto.test.ts), [test](tests/rfid/rfidCredentialLifecycle.test.ts) |
| **Encrypted Backups** | `Software-verified` | Automated pg_dump extraction, age key encryption, Cloudflare R2 offsite replication, and restore drill script. _Limits: Cloudflare R2 offsite sync requires external credentials; automated restores verified in container drills._ | [test](tests/disasterRecovery.test.ts), [load-test](docs/evidence/2026-10-load-test.md) |
| **Tenant isolation (RLS)** | `Software-verified` | FORCE RLS on tenant tables; transaction-local tenant context; pooled-connection leak tests. _Limits: System-level super-admin queries bypass tenant scoping; requires audited session context._ | [test](tests/security/csrf-exemptions.test.ts), [load-test](docs/evidence/2026-10-load-test.md) |
| **Offline QR Attendance** | `Software-verified` | Dexie.js indexed storage, cryptographically signed event queue, mobile camera scanning, and idempotent reconnect sync. _Limits: Requires browser camera permissions; iOS background sync requires foreground tab reactivation._ | [test](tests/crossSchoolOfflineScoping.test.ts), [test](tests/offlineDbMigration.test.ts) |
| **Session Finalization & DLT SMS Queue** | `Software-verified` | Atomic attendance session lock, idempotent SMS job generation, Telecom DLT template formatting, and HMAC callback processing. _Limits: Real SMS transmission requires approved DLT headers, templates, and active telecom gateway account._ | [test](tests/notificationsAndSms.test.ts), [test](tests/dltSmsProvider.test.ts) |
| **Multilingual UI** | `Software-verified` | Complete trilingual English, Bengali, and Hindi localization across all role dashboards and forms. _Limits: Field pilot linguistic validation across rural districts is ongoing._ | [test](tests/i18nCompleteness.test.ts), [test](tests/landingPageLocalization.test.ts) |
| **Administrative Reporting** | `Software-verified` | ExcelJS monthly registers, daily rosters, absentee breakdowns, and corrections audit exports. _Limits: Exports are designed for internal school management; school headmaster must review before external submission._ | [test](tests/dailyReportsFormatting.test.ts) |
<!-- status:end -->

## What it does

- **Ingests HTTP POST batches** from a Zebra FX9600 UHF RFID reader at the gate.
- **Identifies students by hashed EPC**, recording attendance in PostgreSQL with multi-tenant row-level security (`FORCE ROW LEVEL SECURITY`).
- **Queues DLT-templated SMS** to guardians on first mark via telecom provider.
- **Falls back to offline camera-based QR scanning** in the teacher's browser if the gate or power fails.
- **Ships as a single self-hosted appliance** on Debian/Ubuntu with Docker Compose, PostgreSQL 16, and Redis.

## What it doesn't do

<!-- claims-allow: cert | explicit disclaimer stating absence of certification -->
<!-- claims-allow: gov | explicit disclaimer stating absence of government certification -->
- ❌ **Does not verify who carried the badge.** UHF RFID identifies the badge, not the student carrying it (see [THREAT_MODEL.md](THREAT_MODEL.md)).
- ❌ **Does not use encrypted credentials on the badge.** UHF EPC badges are readable by any Gen 2 reader and can be cloned with inexpensive writers. Not a secure access-control system.
- ❌ **Does not file directly to UDISE+.** Exports CSV/XLSX registers in the state's requested column format; portal filing remains the school's responsibility.
- ❌ **Is not certified by any government body.**

## Measured performance

Performance targets and measured thresholds on a 4 GB single-box appliance:

| Workload | Target / Measured | Environment | Evidence |
|---|---|---|---|
| **Zebra RFID batch ingest** | p95 < 300 ms, 100 RPS | 4 GB ARM / Docker appliance | [test](tests/rfid/zebraIotConnector.test.ts), [slo](docs/evidence/2026-10-performance-slo.md) |
| **Student QR scan ingest** | p95 < 150 ms, 250 RPS | Controlled load profile | [test](tests/crossSchoolOfflineScoping.test.ts), [slo](docs/evidence/2026-10-performance-slo.md) |
| **Offline batch sync storm** | p95 < 300 ms, 50 RPS | IndexedDB to server reconnect | [test](tests/offlineDbMigration.test.ts), [slo](docs/evidence/2026-10-performance-slo.md) |
| **Parent SMS dispatch queue** | 200 msg/s dispatch | Background Redis queue | [test](tests/notificationsAndSms.test.ts), [test](tests/dltSmsProvider.test.ts) |

## Quick start

On an Ubuntu 22.04/24.04 LTS (x86_64 or ARM64) server or appliance:

```bash
curl -fsSL https://raw.githubusercontent.com/Kh3rwa1/attendease-os/main/scripts/install.sh | sudo bash
```

The installer verifies pre-flight requirements (RAM, disk, Docker Compose), generates cryptographically secure secrets with `0600` permissions, pulls container images, starts services, and verifies the `/readyz` probe.

### Daily operations

Use the CLI helper `./bin/attendease` on the appliance:

```bash
./bin/attendease status       # Check container health and services
./bin/attendease backup       # Take an age-encrypted database snapshot
./bin/attendease restore <f>  # Restore from an age-encrypted archive (--dry-run supported)
./bin/attendease diagnostics  # Run full system diagnostics
```

## Documentation

Explore the complete documentation in [docs/README.md](docs/README.md):

- [Tutorials](docs/tutorials/): First-run setup and teacher guides.
- [How-to Guides](docs/how-to/): Ingesting Zebra batches, configuring DLT SMS, running restore drills.
- [Reference](docs/reference/): [Configuration](docs/reference/configuration.md), [Decisions](docs/reference/decisions.md), [OpenAPI Specification](docs/reference/openapi.json).
- [Explanation](docs/explanation/): [Architecture](docs/explanation/architecture.md), [Data Protection](docs/explanation/data-protection.md), [Threat Model](THREAT_MODEL.md).
- [Security](SECURITY.md): Vulnerability reporting policy and supported versions.

## License

MIT License. See [LICENSE](LICENSE) for details.
