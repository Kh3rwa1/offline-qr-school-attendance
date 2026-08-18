# AttendEase OS — External Validation & Certification Register

> **Document Status**: `LIVING_REGISTER`  
> **Policy**: AttendEase maintains a strict zero-fabrication policy. All external milestones, certifications, and human field evaluations remain classified as `EXTERNALLY_PENDING` until physical evidence and signed third-party reports are recorded below.

---

## 1. External Validation Register Summary

| Tracked Domain | Validation Milestone | Current Status | Prerequisite Evidence | Target Date |
| :--- | :--- | :---: | :--- | :---: |
| **User Experience** | **Teacher Field UAT** | `EXTERNALLY_PENDING` | Min. 10 rural classroom teachers testing offline scan & review | 2026-Q4 |
| **User Experience** | **Headmaster / Admin UAT** | `EXTERNALLY_PENDING` | Min. 5 school administrators testing roster import & exports | 2026-Q4 |
| **Accessibility** | **Human Screen-Reader UAT** | `EXTERNALLY_PENDING` | TalkBack, VoiceOver & NVDA evaluations per [`ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md`](ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md) | 2026-Q4 |
| **Hardware** | **Physical Zebra FX9600 Commissioning** | `EXTERNALLY_PENDING` | On-site installation, RF tuning & signed report per [`FX9600_COMMISSIONING_TEMPLATE.md`](../hardware/FX9600_COMMISSIONING_TEMPLATE.md) | 2026-Q4 |
| **Telecom** | **Indian DLT Carrier SMS Dispatch** | `EXTERNALLY_PENDING` | Active principal entity DLT registration with Airtel/Jio/Vi | 2026-Q4 |
| **Security** | **Independent Third-Party VAPT** | `EXTERNALLY_PENDING` | CERT-In empaneled auditor security assessment report | 2027-Q1 |
| **Compliance** | **External Legal DPDP Review** | `EXTERNALLY_PENDING` | Formal legal opinion on DPDP compliance and consent architecture | 2027-Q1 |
| **Government** | **Official Education Authority Acceptance** | `EXTERNALLY_PENDING` | Formal acceptance by District Education Officer (DEO) or equivalent | 2027-Q1 |

---

## 2. Detailed Tracking Records

### EV-01: Teacher Field User Acceptance Testing
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Classroom roll call, camera autofocus on varied low-cost Android phones, offline IndexedDB sync.
- **Evidence Attached**: None (Pending field deployment).

### EV-02: Headmaster / Administrator User Acceptance Testing
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Setup wizard, CSV roster upload, staff role management, monthly report generation.
- **Evidence Attached**: None (Pending field deployment).

### EV-03: Human Accessibility Testing (TalkBack / VoiceOver / NVDA)
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Screen-reader task completion across all core operational journeys.
- **Specification**: [`docs/audits/ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md`](ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md)
- **Evidence Attached**: None (Pending human user evaluation).

### EV-04: Physical Zebra FX9600 On-Site Reader Commissioning
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Physical reader mounted at entrance doorway, AN480 antenna RF tuning, doorway rush-hour verification.
- **Specification**: [`docs/hardware/FX9600_EVIDENCE_REQUIREMENTS.md`](../hardware/FX9600_EVIDENCE_REQUIREMENTS.md)
- **Evidence Attached**: None (Pending on-site reader deployment).

### EV-05: Real Indian DLT Telecom SMS Delivery
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Production SMS delivery across Indian mobile networks (Jio, Airtel, Vi, BSNL) using registered DLT header & approved templates.
- **Evidence Attached**: None (Pending institutional DLT credentials).

### EV-06: Independent Third-Party Security Penetration Testing (VAPT)
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Grey-box web application penetration test, API security, multi-tenant PostgreSQL RLS bypass audit.
- **Evidence Attached**: None (Pending external audit engagement).

### EV-07: External Legal DPDP Compliance Review
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Privacy policy audit, consent capture mechanisms, data principal rights workflows, parental consent.
- **Evidence Attached**: None (Pending independent legal counsel review).

### EV-08: Official Government Education Authority Report Acceptance
- **Status**: `EXTERNALLY_PENDING`
- **Scope**: Verification of AttendEase exported attendance sheets by West Bengal education authorities.
- **Evidence Attached**: None (Pending administrative submission).
