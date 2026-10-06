# Children's Data Protection Legal Review Summary

## Overview

A structured data protection review of AttendeEase's handling of children's attendance information was conducted by counsel specializing in Indian data protection practice on 2026-10-06.

The review evaluated:
1. The project data inventory and schema classification (`THREAT_MODEL.md`).
2. Guardian consent workflows for minors under 18 years of age (`guardian_consents`).
3. Automated retention purge policies (`retention_policies`).
4. Data erasure and pseudonymization implementations (`/students/:studentId/anonymize`).
5. Telecommunications and SMS processor data sharing protocols.

## Implemented Controls

Following the legal review, the following controls have been incorporated into the software:

- **Explicit Guardian Consent Granularity:** Separate opt-in flags for RFID attendance tracking, absence SMS alerts, and student facial photos (`RFID_ATTENDANCE`, `ABSENCE_SMS`, `PHOTO`). Credentials cannot be provisioned without verified guardian consent.
- **Data Subject Rights & Export:** Administrators can produce a machine-readable JSON archive of all records, scan events, and consents associated with a student via `GET /students/:studentId/data-export`.
- **Pseudonymous Erasure (Right to Erasure):** When an erasure request is executed, student PII is replaced with pseudonymous identifiers (`ANON-*`), biometric and facial assets are expunged, and contact numbers are redacted to preserve mandatory aggregate academic reporting without retaining identifiable attributes.
- **Automated Retention Enforcement:** High-frequency physical telemetry (`rfid_scan_events`) is purged after 180 days by default in batch deletions, while notification dispatch logs are expunged after 365 days.
- **Safety Window for Telecommunications:** Absences are held in a scheduled queue for 20 minutes (`ABSENCE_SMS_DELAY_MINUTES`) to avoid inaccurate dispatches to guardians.
