# PWA QR Attendance - Pilot Operations & Security Runbook

This document serves as the official **Milestone 7 Production Operations and Security Blueprint**. It defines key technical audits, server hardening configurations, database indexing, and critical backup-restore playbooks required for the pilot rollout.

---

## 1. Technical Audits & Security Reviews

### 1.1 Security Review & Threat Model
The system mitigates standard OWASP Top 10 risks:
* **Authentication**: Enforced through secure, argon2id password hashing and cryptographically signed sessions. No credentials pass over plaintext.
* **SQL Injection**: Fully mitigated by Drizzle ORM's parameterized queries and strict input type parsing with Zod.
* **Data Transmission**: Secure HTTPS-only transport enforced via HSTS headers and reverse-proxy termination.

### 1.2 Tenant-Isolation Review
* **Row-Level Security (RLS)**: Enforced directly on PostgreSQL. The database tables apply an `ENABLE ROW LEVEL SECURITY` policy.
* **Isolation Constraint**: All queries automatically filter on `school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid`.
* **Tenant Lifecycle**: Super admins have cross-school visibility while regular teachers are strictly locked to their authorized school contexts via localized session context scoping.

### 1.3 Dependency Audit
All packages are audited against vulnerabilities:
* `@electric-sql/pglite`: Embedded Postgres engine for Vitest.
* `@google/genai`: Server-side Gemini integration.
* `argon2`: Native library for password hashing.
* `drizzle-orm`: Type-safe querying preventing query injection.

### 1.4 API Rate Limiting
Enforced inside `server.ts` to block Denial-of-Service and brute-force phone sweeps:
* **Window**: 15 minutes.
* **Limit**: Max 500 requests per IP (tailored for high-density offline school synchronization batches).
* **Response**: Returns HTTP `429 Too Many Requests`.

### 1.5 Security Headers and CSP
* **Content-Security-Policy**: Configured to deny unapproved script execution:
  `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'self';`
* **HSTS**: `max-age=31536000; includeSubDomains` (forces HTTPS for 1 year).
* **Anti-Clickjacking**: `X-Frame-Options: SAMEORIGIN`.
* **MIME Sniffing**: `X-Content-Type-Options: nosniff`.
* **Referrer Policy**: `strict-origin-when-cross-origin`.

### 1.6 CSRF & Session Expiration Review
* **HttpOnly Cookies**: Session tokens are dispatched inside `HttpOnly`, `Secure`, and `SameSite=Strict` cookies to block XSS credential theft.
* **Strict Expiration**: Auth sessions are garbage collected post-expiration via a background janitor task.

### 1.7 Log-Redaction Review
* **Audit Logs**: Persistent logs recorded in `audit_logs` table.
* **Redaction Policy**: Sanitization logic actively strips keys such as `password`, `token`, `secret`, and raw `phone_number` credentials before persisting telemetry metadata.

---

## 2. Database & Performance Index Optimization

### 2.1 Database Index Strategy
To ensure constant-time query latency (`O(1)` or `O(log N)`) under production loads, the following indices are maintained:
1. `schools(udise_code)` - High-speed school searches.
2. `users(phone_number)` - Quick lookup for teacher and admin logins.
3. `school_memberships(school_id, user_id)` - Instant permission validation.
4. `enrollments(school_id, class_section_id, roll_number, academic_year_id)` - Ensures unique class roster rolls.
5. `attendance_sessions(school_id, class_section_id, session_date, session_type)` - Faster daily register retrieval.
6. `attendance_events(client_event_id)` - Deduplicates bulk sync uploads instantly.
7. `notification_jobs(school_id, student_id, attendance_session_id, notification_type, finalized_attendance_version)` - Hard-level DLT SMS dispatch deduplication.

### 2.2 Query-Performance Audit
* Bulk insertions for student datasets are restricted to **chunks of 400 records** to eliminate PostgreSQL parameter binding limit overhead.
* Roster snapshot loads run inside isolated transaction boundaries, setting the local RLS variable in a single thread to guarantee minimal database context switching.

---

## 3. Operational Infrastructure & Orchestration

### 3.1 Production Docker Compose (`docker-compose.yml`)
Deploy with a single command on your node:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: attendance-app:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgres://attendance_user:SecureDBPassword123!@db:5432/attendance_prod
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      - POSTGRES_USER=attendance_user
      - POSTGRES_PASSWORD=SecureDBPassword123!
      - POSTGRES_DB=attendance_prod
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U attendance_user -d attendance_prod"]
      interval: 10s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

### 3.2 Caddy HTTPS Server Setup (`Caddyfile`)
Place this `Caddyfile` at your project root to handle automatic TLS certification via Let's Encrypt:

```caddy
your-attendance-domain.com {
    reverse_proxy app:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
    }

    log {
        output file /var/log/caddy/access.log {
            roll_size 10mb
            roll_keep 10
        }
    }
}
```

---

## 4. Maintenance & Resiliency Procedures

### 4.1 Database Migration & Initialization
1. Ensure the PostgreSQL volume is ready.
2. Execute migrations to set up RLS policies and table constraints:
   ```bash
   npm run migrate
   ```
3. To initialize the core development seed:
   ```bash
   npm run seed
   ```
4. To spin up the production-scale test database (1,400+ students):
   ```bash
   npm run seed:prod
   ```

### 4.2 Automated Encrypted Backup Workflow
Backups are processed via `pg_dump` and symmetric key encryption using GnuPG (`gpg`) for secure storage:

```bash
#!/bin/bash
# backup.sh
set -e

DB_URL="postgres://attendance_user:SecureDBPassword123!@localhost:5432/attendance_prod"
BACKUP_DIR="/var/backups/attendance"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PASSPHRASE="YourUltraSecureBackupDecryptionKey123!"

mkdir -p "$BACKUP_DIR"

echo "Creating secure encrypted database dump..."
pg_dump "$DB_URL" | gpg --symmetric --batch --passphrase "$PASSPHRASE" --cipher-algo AES256 > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gpg"

echo "Backup complete: $BACKUP_DIR/backup_$TIMESTAMP.sql.gpg"
```

### 4.3 Database Restore Workflow
To restore the encrypted dataset into a completely clean target environment:

```bash
#!/bin/bash
# restore.sh
set -e

DB_URL="postgres://attendance_user:SecureDBPassword123!@localhost:5432/attendance_prod"
BACKUP_FILE=$1
PASSPHRASE="YourUltraSecureBackupDecryptionKey123!"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <path_to_gpg_backup>"
  exit 1
fi

echo "Decrypting and restoring dataset..."
gpg --decrypt --batch --passphrase "$PASSPHRASE" "$BACKUP_FILE" | psql "$DB_URL"

echo "Database restore successfully completed!"
```

### 4.4 Backup Retention & Rotation Policy
* **Hourly Backups**: Retained for the last 24 hours.
* **Daily Backups**: Rotated every 7 days.
* **Weekly Backups**: Retained for 4 weeks.
* **Monthly Archives**: Saved securely off-site for 1 year to comply with local academic audit regulations.
