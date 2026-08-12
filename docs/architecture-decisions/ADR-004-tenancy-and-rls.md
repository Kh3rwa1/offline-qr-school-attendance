# ADR-004: Multi-Tenant Architecture and Database Row-Level Security

* **Status:** Approved
* **Date:** 2026-08-11
* **Context:** The system hosts multiple government schools on a shared database. Strict isolation is required to prevent any school from viewing or modifying another school's student data or attendance logs.

## Decision
1. **Mandatory Tenant Foreign Key:** Every tenant-scoped database table includes `school_id UUID NOT NULL`.
2. **Server-Side Authorization Layer:** Express middleware verifies user's active `school_memberships` role before processing any endpoint logic.
3. **PostgreSQL Row-Level Security (RLS):** Database connection sessions set `app.current_school_id`. RLS policies on all tenant tables restrict queries to rows matching `school_id = current_setting('app.current_school_id')`.
4. **SUPER_ADMIN Audit Bypass:** Super Admin access bypasses RLS through explicit, audited database connection paths with logging.

## Consequences
* **Positives:** Defense-in-depth protection against SQL injection or application-level tenant isolation bugs.
* **Negatives:** Requires setting session context variables on pooled database connections before query execution.
