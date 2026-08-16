# Non-Super Admin Route & Component Audit

This audit evaluates all authenticated routes accessible by Teacher, School Administrator, Gate Operator, and Report Viewer roles to guarantee zero exposed technical jargon, complete English and Bengali localization, and touch-friendly responsive UX.

## 1. Route Inventory and Assessment

| Route Path | Primary Role | Mental Model & Plain Language Name | Localization Parity | Touch Target & WCAG Compliance |
| :--- | :--- | :--- | :--- | :--- |
| `/app/teacher` | Teacher | Classroom Attendance & QR Scan (`Today's Attendance` / `আজকের উপস্থিতি`) | 100% EN/BN | $\ge 48\text{px}$ buttons, high contrast, auto-focus |
| `/app/teacher/classes` | Teacher | My Assigned Classes (`My Assigned Classes` / `আমার নির্ধারিত ক্লাস`) | 100% EN/BN | 1-tap "Take Attendance" cards ($\ge 44\text{px}$) |
| `/app/teacher/offline` | Teacher | Saved Attendance on this Phone (`Saved Attendance` / `এই ফোনে সংরক্ষিত উপস্থিতি`) | 100% EN/BN | Clear sync action button, zero DB jargon |
| `/app/school-admin` | School Admin | School Overview (`Overview` / `সারসংক্ষেপ`) | 100% EN/BN | 3 clean stat cards + 4 large action cards |
| `/app/school-admin/users` | School Admin | School Staff Directory (`School Staff` / `বিদ্যালয় কর্মী`) | 100% EN/BN | Accessible modals, confirmation dialogs |
| `/app/school-admin/students` | School Admin | Student Roster (`Students` / `শিক্ষার্থী`) | 100% EN/BN | Step-by-step add/import, roll number search |
| `/app/school-admin/academics` | School Admin | Classes & Sections (`Classes & Sections` / `ক্লাস ও শাখা`) | 100% EN/BN | Simple add class/year modals |
| `/app/school-admin/attendance` | School Admin | Daily Attendance Review (`Daily Attendance` / `দৈনিক উপস্থিতি`) | 100% EN/BN | Correction modal with reason audit log |
| `/app/school-admin/notifications`| School Admin | Parent Messages (`Parent Messages` / `অভিভাবকদের বার্তা`) | 100% EN/BN | One-tap retry failed messages |
| `/app/rfid-operator` | Gate Operator | School Gate Attendance (`School Gate` / `বিদ্যালয় গেট`) | 100% EN/BN | Real-time arrival feed, clear status |
| `/app/reports` | Report Viewer | Reports & Analytics (`Reports & Analytics` / `রিপোর্ট ও বিশ্লেষণ`) | 100% EN/BN | Truthful live turnout gauge, zero fake data |
| `/app/reports/daily` | Report Viewer | Daily Roll Sheet (`Daily Roll` / `দৈনিক খাতা`) | 100% EN/BN | Mid-day meal headcount & print layout |
| `/app/reports/trends` | Report Viewer | Monthly Turnout Trends (`Monthly Trends` / `মাসিক গতিপ্রকৃতি`) | 100% EN/BN | 7-day / 30-day selector, absentee patterns |
| `/app/reports/exports` | Report Viewer | Download Official Reports (`Export & Download` / `সরকারি রিপোর্ট ডাউনলোড`) | 100% EN/BN | One-click CSV and Excel downloads |

---

## 2. Shared Layout Audit

- **TopBar (`src/layouts/TopBar.tsx`)**:
  - Offline sync status pill shows plain English/Bengali ("Internet Connected" / "No Internet — attendance safe on mobile").
  - School switcher and role badge clearly identifiable.
  - Language toggle accessible in 1 tap.
- **Sidebar & Mobile Navigation (`src/layouts/Sidebar.tsx`, `MobileNavigation.tsx`)**:
  - Filtered by active role.
  - Touch targets $\ge 48\text{px}$ on mobile bottom navigation bar.
  - Active route highlighted with forest green accent.
