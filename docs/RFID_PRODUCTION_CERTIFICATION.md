# RFID Production Certification

## Certification Checklist (20-Point Verification)
1. [ ] SECURE mode enabled and verified.
2. [ ] UID_LEGACY mode explicitly disabled by default.
3. [ ] Raw UIDs never logged or stored.
4. [ ] HMAC-SHA256 implemented for UID digests.
5. [ ] mTLS authentication enforced on Gateway ingress.
6. [ ] Redis rate-limiting active.
7. [ ] Redis duplicate-tap detection active.
8. [ ] Replay protection (nonce) verified.
9. [ ] RLS policies active on all RFID tables.
10. [ ] `app.current_school_id` bound correctly in transactions.
11. [ ] Key rotation endpoints secured and functional.
12. [ ] Database migrations executed successfully.
13. [ ] Prometheus metrics exposed and scraping.
14. [ ] Offline queue bounds tested and enforced.
15. [ ] Event signing verified.
16. [ ] Hardware adapters verified against matrix.
17. [ ] No card secrets exposed to browser context.
18. [ ] Production startup validation asserts secure config.
19. [ ] Load testing confirms performance (100+ taps/sec).
20. [ ] Emergency rollback procedure documented and tested.

## Pre-deployment Requirements
- Hardware certification evidence submitted.
- Security scan (SAST/DAST) passed.
- Load test thresholds met.

## Sign-off
**Date:**
**Architect:**
**Security Lead:**
