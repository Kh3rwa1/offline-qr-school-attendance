# Government-Ready Attendance Reporting & Excel Export System

## Overview

The Government-Ready Attendance Reporting & Excel Export System provides school administrators, headmasters, teachers, and reporting officials with precision-engineered, tamper-evident attendance registers and summary packages formatted for institutional management reporting and state compliance (e.g., West Bengal UDISE+ and Banglar Shiksha identifier alignment).

---

## Key Features

1. **One-Click Instant Monthly Register**:
   - Downloads a complete, multi-sheet formatted Excel `.xlsx` workbook containing all classes and sections with day-by-day attendance matrices for the current month.
2. **Unified 6-Step Guided Wizard**:
   - **Step 1: Report Type**: Monthly Register, Daily Class Register, Whole-School Turnout Summary, Academic-Year Register, Absentee Report, Consecutive Absence (3+ days) Alert, Late Arrivals, Corrections Audit Log, Missing/Unmarked Data, and Complete Management Package.
   - **Step 2: Scope**: Whole School, All Classes & Sections, Selected Classes (with search & multi-select), or Specific Section.
   - **Step 3: Period**: Today, Yesterday, Current Month, Previous Month, Specific Month/Year, Current Academic Year, or Custom Date Range.
   - **Step 4: Format**: Styled Multi-Sheet Excel Workbook (`.xlsx`), RFC 4180 UTF-8 CSV (`.csv`), or Print View HTML.
   - **Step 5: Pre-Flight Validation & Reconciliation**: Real-time evaluation of blocking data integrity errors vs. non-blocking warnings with direct navigation links.
   - **Step 6: Download & Integrity Record**: Automatic browser download with SHA-256 hash tracking and immutable audit logging.
3. **Institutional Certification & Disclaimer Standards**:
   - Clear distinction between *internal management approval* and government portal submissions.
   - Automatic inclusion of standard legal disclaimer:
     > *"Institutional attendance report generated for school administration and management records. This export formats school data for institutional reporting and does not constitute official certification or proof of direct government portal submission."*
4. **Academic Calendar & Working-Day Precision**:
   - Strict working-day accounting ensuring gazetted holidays, vacations, emergency closures, and Sundays are **never treated as student absences**.
   - Attendance rate is strictly $(\text{Present} + \text{Late}) / \text{Working Days} \times 100\%$.

---

## Excel Workbook Structure

Every generated `.xlsx` workbook includes:

- **Cover & Certification Sheet**: School name, UDISE code, Circle, Block, District, Reporting Period, Internal Approval Status, SHA-256 Checksum, Headmaster signature box, and official School Seal box.
- **School Summary Sheet**: Aggregated turnout across all classes, gender metrics, working days, present/late/absent counts, and percentage turnout.
- **Monthly Register Sheets (1 sheet per Class Section)**:
  - Frozen panes (Roll, IDs, Student Names locked on horizontal scroll).
  - Daily status columns (Day 1 through Day 31) with color-coded status codes:
    - `P`: Present (Green)
    - `L`: Late Arrival (Amber)
    - `A`: Absent (Red)
    - `E`: Excused / Approved Leave (Blue)
    - `H`: Government / School Holiday (Gray)
    - `W`: Sunday / Weekend (Gray)
    - `U`: Unmarked / Session Pending (Light Gray)
  - Calculated Totals & Attendance Percentage (`0.0%`).
- **Consecutive Absences (3+ Days) Sheet**: Highlights students at academic or welfare risk.
- **Attendance Corrections Sheet**: Detailed audit trail of all manual status overrides with timestamps, reasons, and approving user identities.
- **Academic Calendar Sheet**: Complete breakdown of gazetted holidays and working day classifications for the period.
- **Export Metadata Sheet**: Generation timestamp, system version, export profile, user ID, and cryptographic SHA-256 digest.

---

## Security & Anti-Tampering Protections

- **Formula Injection Prevention (OWASP & RFC)**: All string cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are sanitized with a leading `'` to guarantee spreadsheet software interprets them as text.
- **Privacy & PII Protection**: Guardian contact numbers and private credentials are excluded from attendance registers by default.
- **PostgreSQL Row-Level Security (RLS)**: Strict tenant isolation prevents cross-school data access or report generation.
