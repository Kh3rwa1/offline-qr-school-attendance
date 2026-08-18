# Reporting Security, Privacy, and Integrity

## Trust boundary

Attendance exports contain student data. Treat every generated artifact as confidential school data. The reporting feature is for internal administration; internal approval is not government certification or proof of portal submission.

## Tenant and scope enforcement

- Every reporting endpoint requires an authenticated, active membership in the requested school.
- Requested classes and students are queried under the active PostgreSQL tenant context.
- Empty selected scopes and identifiers belonging to another school are rejected.
- Teacher access is limited by active class assignments; school administrators, head teachers, and report viewers retain school-wide reporting access.
- Reporting, calendar, profile, approval, and artifact tables use PostgreSQL row-level security with `FORCE ROW LEVEL SECURITY`.

Application checks improve error messages, but database RLS is the final isolation boundary.

## Immutable artifact model

Generation persists the exact binary payload before it returns a download URL. Each artifact records:

- school and report identifiers;
- requested format and matching MIME type;
- safe server-generated filename;
- exact byte length;
- SHA-256 of the exact payload;
- storage backend and opaque storage key;
- profile, calendar, and request snapshots;
- creation actor and timestamp.

The artifact table exposes tenant-scoped `SELECT` and `INSERT` policies only. No API route updates or deletes artifact rows. Repeated downloads read the stored bytes instead of regenerating from mutable attendance rows.

An internal report cannot be approved unless its artifact exists. Downloading an approved report does not reset or weaken its lifecycle state.

## Storage backends

### Database (default)

The payload is stored in PostgreSQL `BYTEA`. Include the database in encrypted backups and exercise restore drills. Database access control and RLS protect the metadata and bytes together.

### Local filesystem (optional)

The service writes to a configured artifact root with an opaque generated key, atomic rename, directory mode `0700`, and file mode `0600`. The resolved path must remain inside the configured root. The database stores metadata and the storage key, not a user-controlled path.

Use filesystem mode only when:

- the directory is on durable encrypted storage;
- every serving replica can reach the same bytes;
- the directory is included in tested off-appliance backups;
- operating-system access is restricted to the application account.

The application does not claim live S3/R2 support in this contract.

## Spreadsheet and HTML defenses

CSV and workbook text values beginning with `=`, `+`, `-`, `@`, tab, or carriage return after leading whitespace are prefixed with a single quote before export. This prevents values from being interpreted as spreadsheet formulas.

HTML values are escaped before insertion into the standalone document. The exporter does not place untrusted text into executable script, style, or event-handler contexts.

## Privacy defaults

The built-in profile includes attendance identifiers and names needed for internal registers. Guardian phone numbers, credentials, and national identity numbers are not included by default. If a school adds a custom profile, the school is responsible for data-minimization review and destination authorization.

## Integrity verification

To verify a download independently:

```bash
sha256sum downloaded-report.xlsx
```

Compare the 64-character lowercase digest with the API response or artifact audit record. A match proves byte identity with the stored artifact; it does not prove that the source attendance data was complete or accepted by an external authority.

## Output and abuse bounds

Generation validates date-span, student-count, and estimated-cell limits before expensive export work. A bounded queue caps simultaneous work and pending requests. Artifact byte size is checked before storage. These controls reduce accidental memory exhaustion; production deployments should also retain reverse-proxy request limits, process limits, monitoring, and rate limiting.

## Audit and retention

Generation, download, approval, and supersession actions are written to the audit log. Artifact rows are intentionally immutable. Define a documented retention period and a privileged maintenance process for legally required deletion; do not add a normal application delete endpoint that bypasses review.

## Remaining external validation

The repository's automated tests cannot establish:

- acceptance by a government portal;
- compliance with a future authority-issued template;
- legal sufficiency in a particular jurisdiction;
- successful backup-key custody outside the appliance;
- operation of external object storage not configured in the test environment.

Record those as deployment or organizational evidence, not software claims.