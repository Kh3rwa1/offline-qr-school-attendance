# Security Architecture & Threat Model

## 1. Threat Matrix & Defensive Countermeasures

| Threat Vector | Severity | Attack Surface | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Data Leakage** | CRITICAL | REST APIs, Database Queries | Multi-tenant `school_id` isolation, server-side tenant validation middleware, and PostgreSQL Row-Level Security (RLS) policies. |
| **QR Code Cloning / Tampering** | HIGH | Physical QR Cards | QR codes contain no student PII. They carry 128-bit cryptographically secure opaque random secrets. Scans trigger mandatory visual confirmation (Student Photo, Bengali Name, Roll No). |
| **Compromised / Lost Teacher Phone** | HIGH | Local Offline Storage | PWA stores minimal roster info in IndexedDB. **Guardian phone numbers are strictly prohibited from client caching.** Remote device revocation instantly blocks sync endpoints. |
| **Replay & Injection Attacks** | MEDIUM | Sync Endpoints (`/api/v1/sync`) | Event deduplication via unique `client_event_id`, rate limiting, input validation via Zod, signed session cookies. |
| **Unpermitted Administrative Escalation** | HIGH | Teacher Account | Strict Role-Based Access Control (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `REPORT_VIEWER`). Teachers cannot trigger admin API routes. |
| **PII Exposure in Logs** | MEDIUM | Application Logs | Sensitive data filtering: Passwords, session tokens, raw QR secrets, and guardian phone numbers are automatically redacted from logs. |

---

## 2. Authentication & Authorization Controls

### Password Security
- **Algorithm:** Argon2id (memory cost: 65536 KB, iterations: 3, parallelism: 4).
- **Storage:** Only password hashes are saved in `users.password_hash`.

### Session Management
- **Cookies:** HTTP-only, Secure, SameSite=Lax (or Strict where supported), path-restricted session cookies.
- **Rotation:** Session tokens are rotated upon privilege change and expire automatically after 24 hours of inactivity.

### Role-Based Access Control Matrix

| Action / Capability | SUPER_ADMIN | SCHOOL_ADMIN | TEACHER | REPORT_VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| **Create / Suspend Schools** | YES | NO | NO | NO |
| **Manage Teachers & Assignments** | YES | YES | NO | NO |
| **Import / Export Student Rosters** | YES | YES | NO | NO |
| **Issue / Revoke QR Cards** | YES | YES | NO | NO |
| **Start / Scan Attendance Session** | YES | YES | YES | NO |
| **Finalize Attendance Session** | YES | YES | YES | NO |
| **Reopen Session / Modify Correction** | YES | YES | NO | NO |
| **Export Attendance Reports** | YES | YES | READ-ONLY | READ-ONLY |

---

## 3. Data Protection & Privacy Compliance

1. **Aadhaar Protection:** The application **does not collect, store, or process Aadhaar numbers** under any circumstance.
2. **Student PII Minimization:** Only necessary fields (`student_code`, `banglar_shiksha_id`, `name`, `name_bn`, `date_of_birth`, `gender`, `photo_url`) are processed.
3. **Redacted Logging Policy:** Application loggers enforce masking filters:
   - Phone numbers: `+91 ******1234`
   - Secrets / Tokens: `[REDACTED]`
4. **Encrypted Backups:** Database dumps (`pg_dump`) are encrypted using AES-256 before offsite replication.
