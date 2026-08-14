# RBAC and Dashboard Route Map

| Role | Default Route | Primary Permissions |
| --- | --- | --- |
| `SUPER_ADMIN` | `/app/super-admin` | Platform school/security/audit visibility and explicitly audited system operations |
| `SCHOOL_ADMIN` | `/app/school-admin` | School users, academics, attendance, QR, notifications, RFID, reports |
| `TEACHER` | `/app/teacher` | Assigned attendance sessions, review/finalize after sync, bounded offline workspace |
| `REPORT_VIEWER` | `/app/reports` | Read-only reports and audited CSV exports |
| `RFID_OPERATOR` | `/app/rfid` | RFID dashboard, readers, cards, enrollment, events, RFID reports |

## Permission Rules

`src/auth/permissions.ts` is the single typed client navigation model. It must never replace backend authorization. The backend derives the active role from the database-backed session and applies route-specific checks. Tenant queries run inside `withTenantContext(schoolId)`; platform summaries use narrowly scoped `withSystemContext()` services. A user’s memberships are not merged: only the active membership contributes permissions.

Teacher offline cache is an attendance continuity mechanism, not an authorization mechanism. Cached administrative, report mutation, RFID, and cross-school operations are unavailable offline.

## Route Hierarchies

- **SUPER_ADMIN**: `/app/super-admin`, `/app/super-admin/schools`, `/app/super-admin/security`, `/app/super-admin/audit`
- **SCHOOL_ADMIN**: `/app/school-admin`, `/app/school-admin/users`, `/app/school-admin/academics`, `/app/school-admin/attendance`, `/app/school-admin/notifications`
- **TEACHER**: `/app/teacher`, `/app/teacher/classes`, `/app/teacher/offline`
- **REPORT_VIEWER**: `/app/reports`, `/app/reports/daily`, `/app/reports/trends`, `/app/reports/exports`
- **RFID_OPERATOR**: `/app/rfid`, `/app/rfid/readers`, `/app/rfid/cards`, `/app/rfid/enrollment`, `/app/rfid/events`
