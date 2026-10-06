---
title: Documentation Directory
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# AttendEase OS Documentation

Welcome to the AttendEase OS documentation. The documentation is organized according to the Diátaxis framework across four key areas: learning-oriented tutorials, task-oriented how-to guides, information-oriented reference, and understanding-oriented explanations.

## Getting Started (Tutorials)
- [Installation Guide](getting-started/install.md): Installation and setup on bare metal or containerized appliances.
- [First School Setup](getting-started/first-school-setup.md): Walkthrough of the school onboarding wizard, classes, and credentials.

## Operations (How-To Guides)
- [Backup and Restore](operations/backup-and-restore.md): Encrypted database dumps, age encryption, Cloudflare R2 offsite sync, and restore verification.
- [Reader Onboarding](operations/reader-onboarding.md): Zebra FX9600 configuration, IoT Connector setup, and token rotation.
- [Key Rotation](operations/key-rotation.md): Rotating reader secrets, session secrets, and application encryption keys.
- [Incident Response](operations/incident-response.md): Protocols and triage for system failure, offline desynchronization, and credential compromise.
- [Appliance Upgrades](operations/upgrades.md): Version upgrades, database migrations, and rollback procedures.
- [Install Boundaries](operations/INSTALL_AND_FORGET_BOUNDARIES.md): Maintenance boundaries and operations envelope.
- [Incident Runbooks](operations/runbooks/INCIDENT_RUNBOOKS.md): Operator runbooks for common alerts and failures.
- [RFID Runbook](operations/runbooks/RFID_RUNBOOK.md): UHF RFID gate monitoring and troubleshooting runbook.

## Reference
- [API Reference](reference/api.md): REST endpoints, request/response formats, and webhook schemas.
- [Configuration Reference](reference/configuration.md): Environment variables, defaults, and security constraints.
- [Ingest Decisions](reference/decisions.md): Complete list of attendance ingest decisions and operator handling.
- [Role-Based Access Control](reference/rbac.md): Permission matrix across Super Admin, School Admin, Teacher, and Staff roles.
- [Official Reports](reference/reports.md): Attendance register fields, government export formats, and summary calculations.
- [Hardware Compatibility](reference/hardware.md): Supported UHF RFID readers, antenna configurations, and network switches.
- [Academic Calendar](reference/academic-calendar.md): Session calendars, terms, holidays, and working days schema.
- [Database Model](reference/database-model.md): Multi-tenant relational schema and entity relationships.
- [Branch Governance](reference/branch-governance.md): Git branching model and commit standards.
- [UI-API Matrix](reference/ui-api-matrix.md): Traceability matrix of frontend screens to backend API routes.

## Explanation
- [System Architecture](explanation/architecture.md): High-level system topology, database isolation, and ingest flow.
- [Security Model](explanation/security-model.md): Defense-in-depth architecture, cryptographic boundaries, and threat mitigation.
- [Offline Mode](explanation/offline-mode.md): Dexie client storage, outbox queues, cryptographic envelope verification, and reconciliation.
- [Data Protection](explanation/data-protection.md): DPDP alignment, data inventory, tenant boundaries, and retention lifecycles.

## Acceptance & Protocols
- [Site Acceptance Protocol](acceptance/site-acceptance-protocol.md): School gate deployment acceptance and verification steps.
- [User Acceptance Testing (UAT)](acceptance/uat-protocol.md): Comprehensive functional acceptance protocol and teacher verification.
- [Templates](acceptance/templates/): Standardized acceptance sheets, signoff sheets, and hardware commissioning forms.

## Evidence & Benchmarks
- [Performance SLO](evidence/2026-10-performance-slo.md): Latency, throughput, and reliability service level objectives.
- [Benchmark Methodology](evidence/2026-10-benchmark-methodology.md): Reproducible test methodology for synthetic gate load.
- [Load Test Telemetry](evidence/2026-10-load-test.md): Measured performance numbers under gate morning rush load.
- [Pilot Guides](evidence/pilots/): School pilot operational runbooks and teacher cheat-sheets.

## Architecture Decision Records (ADRs)
- [Decisions Directory](decisions/): Architectural decisions ADR-001 through ADR-008 documenting technology choices.

## Style & Language
- [Bengalish Style Guide](style/bengalish-style-guide.md): Bilingual English/Bengali localization grammar and tone.
- [Terminology Matrix](style/terminology.md): Plain-language glossary for administrative and technical terms.

## Archive
- [Historical Reviews](archive/): Pre-v2.0 internal reviews and audits preserved for transparency.
