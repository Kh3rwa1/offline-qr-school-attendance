# Reporting Security, Privacy & Integrity Standard

## 1. Spreadsheet Formula Injection (CSV / Excel Injection) Defenses

When spreadsheet software (Microsoft Excel, LibreOffice Calc, Google Sheets, Apple Numbers) opens a CSV or XLSX file, cells beginning with certain characters are executed as active formulas. Malicious input in student names, remarks, or notes could potentially trigger command execution or exfiltrate data via `DDE()` or `HYPERLINK()`.

### Sanitization Standard

The system implements the RFC and OWASP spreadsheet protection standard:

- Every string cell value is inspected prior to writing.
- If a string begins with `=`, `+`, `-`, `@`, `\t`, or `\r`, or contains these characters following leading whitespace, it is prepended with a single quote character (`'`).
- The single quote instructs spreadsheet applications to treat the entire cell content strictly as text, neutralizing execution.

---

## 2. Privacy by Design & PII Protection

Institutional attendance registers are often printed and pinned in staff rooms or submitted for administrative review. To protect student privacy:

- **Guardian Phone Numbers**: Excluded from default attendance register sheets.
- **National / Aadhaar Identifiers**: Excluded from export registers unless specifically authorized in an administrative profile.
- **Banglar Shiksha Student IDs**: Rendered in dedicated ID columns as official state educational reference numbers.

---

## 3. Cryptographic Integrity & Tamper Evident Exports

To prevent post-generation tampering or alteration of attendance records:

1. **SHA-256 Checksum Calculation**:
   - The exact binary payload of every exported XLSX/CSV file is hashed using SHA-256.
   - The digest is saved in the database `report_approvals` table and stamped on the Cover Sheet and Metadata Sheet of the workbook.
2. **Immutable Audit Trail**:
   - Every report draft generation, internal approval, and download is recorded in the centralized audit log (`audit_logs` table) with the actor ID, timestamp, and metadata.
3. **Version Numbering**:
   - Every generated report receives an explicit version (`v1`, `v2`, ...).
   - If an approved report is re-generated or superseded due to retro-active attendance corrections, the prior version is transitioned to `SUPERSEDED` status, preserving full historical lineage.

---

## 4. Multi-Tenant Row-Level Security (RLS)

All database queries for reporting and calendar management enforce strict tenant isolation:
- PostgreSQL Row-Level Security policies ensure school administrators and teachers can only query data belonging to their active `school_id`.
- The API layer explicitly checks that all requested class section IDs belong to the authorized school before generating report payloads.
