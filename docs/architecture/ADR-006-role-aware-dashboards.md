# ADR-006: Role-aware dashboard routing and parent portal extension point

Status: Accepted

The client uses bookmarkable React Router routes under `/app`, with a shared authenticated shell and typed role/permission navigation. UI guards are only ergonomic; every dashboard API independently derives the active membership and role from the authenticated session and executes tenant reads through `withTenantContext()`. Super Admin platform summaries use a narrowly scoped `withSystemContext()` service.

The default product has five roles: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `REPORT_VIEWER`, and `RFID_OPERATOR`. Teacher offline identity is bounded and limited to attendance work; it cannot authorize administrative or cross-school operations. School switching is a server-side session mutation followed by client query invalidation.

Parent/Guardian is not enabled. A future `/parent` route may be introduced only when `FEATURE_PARENT_PORTAL=true`, after guardian authentication and a verified guardian-to-student relationship are modeled server-side. Phone-number matching alone is insufficient. The future portal may expose only linked-student attendance history and approved notification status; it must never expose rosters, admin/RFID controls, internal audit data, secrets, or school-wide reports.
