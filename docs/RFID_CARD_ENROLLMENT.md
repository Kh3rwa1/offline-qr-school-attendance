# RFID Card Enrollment

## Workflows
### Single Card Enrollment
1. Administrator selects student in UI.
2. Administrator triggers 'Enroll Card'.
3. Card is tapped on enrollment reader (Web Serial or local Gateway).
4. System validates card, provisions keys (if SECURE), and registers HMAC digest.

### Bulk Enrollment
- CSV upload supporting external ID mapping.
- **NO RAW UIDs IN CSV.** CSV must contain pre-hashed identifiers or mapping codes.

## Card Lifecycle States
- **PENDING:** Registered but not yet active.
- **ACTIVE:** Valid for attendance.
- **SUSPENDED:** Temporarily disabled.
- **REVOKED:** Permanently disabled (e.g., lost card).
- **REPLACED:** Superseded by a new card.
- **EXPIRED:** Reached end of validity period.

## Procedures
- **Lost Card:** Immediate transition to REVOKED.
- **Replacement:** Atomic operation revoking old card and activating new card.

## Constraints
- **Role Requirements:** Requires `SCHOOL_ADMIN` or `RFID_OPERATOR` role.
- **Duplicate Detection:** Cannot enroll a card already active in the system.
- **Cross-School Prevention:** RLS ensures a card digest is strictly bound to the enrolling tenant context.
