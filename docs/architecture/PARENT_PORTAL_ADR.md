# Architectural Decision Record (ADR): Parent/Guardian Portal Integration

## Status
**Proposed & Feature-Flagged** (`FEATURE_PARENT_PORTAL=false` by default).

## Context
Educational stakeholder oversight requires a mechanism for parents and guardians to track their student's daily attendance records and receive absence alerts without exposing school administrative controls, fellow student rosters, or cryptographic attendance material.

## Decision
1. **Disabled by Default**: The Parent Portal extension point is strictly gated behind the `FEATURE_PARENT_PORTAL=true` environment configuration.
2. **Server-Enforced Authorization Boundary**:
   - Guardians are authenticated via OTP-verified phone numbers.
   - The backend validates explicit guardian-student linkages (`guardian_students` join table).
   - A guardian cannot query any student record not explicitly mapped to their verified user identity.
3. **Data Access Restrictions**:
   - **Allowed**: Linked student's attendance history, absence explanations, SMS delivery status, official school notices.
   - **Forbidden**: Full class rosters, teacher scanner interfaces, RFID/QR cryptographic keys, administrative override actions, other student records.
4. **Tenant Isolation**: Queries execute strictly within the school tenant context where the student is enrolled.

## Consequences
- Preserves absolute zero-trust privacy between student families.
- Prevents accidental exposure of administrative UI elements to non-staff users.
