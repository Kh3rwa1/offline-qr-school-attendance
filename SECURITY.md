# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x | ✅ Security fixes |
| 1.x | ❌ Upgrade to 2.x (see [Upgrade Guide](docs/operations/upgrades.md)) |

## Reporting a vulnerability

Use GitHub private vulnerability reporting (**Security → Report a vulnerability**).
Please do not open public issues for security reports. We aim to acknowledge reports within 3 working days and share a remediation timeline within 10 days.

Reports involving children's data or cross-school tenant isolation boundaries are prioritized with highest urgency.

## Scope

- **In scope**: This repository, the appliance installer (`scripts/install.sh`), CLI (`bin/attendease`), and published container images (`ghcr.io/kh3rwa1/attendease-os`).
- **Out of scope**: Physical attacks on UHF EPC RFID badges (documented as accepted risk R4/R5 in [THREAT_MODEL.md](THREAT_MODEL.md)), third-party telecom DLT SMS gateways, and local school physical network infrastructure.

## Safe harbor

Good-faith security research conducted within scope, without accessing or exfiltrating real student data or disrupting school operations, will not be pursued legally.
