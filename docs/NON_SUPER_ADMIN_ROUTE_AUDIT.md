# Non-Super Admin Route & Component Audit

This audit evaluates all authenticated routes accessible by Teacher, School Administrator, Gate Operator, and Report Viewer roles to guarantee zero exposed technical jargon, complete English and Bengalish localization, and touch-friendly responsive UX.

---

## 1. Route Inventory and Assessment

| Route Path | Primary Role | Mental Model & Bengalish Name | Localization Parity | Touch Target & WCAG Compliance |
| :--- | :--- | :--- | :--- | :--- |
| `/app/teacher` | Teacher | Classroom Attendance & QR Scan (`Today's Attendance` / `আজকের Attendance`) | 100% EN/Bengalish | $\ge 48\text{px}$ buttons, high contrast, auto-focus |
| `/app/teacher/classes` | Teacher | My Assigned Classes (`My Assigned Classes` / `আমার Assigned Classes`) | 100% EN/Bengalish | 1-tap "Take Attendance" cards ($\ge 44\text{px}$) |
| `/app/teacher/offline` | Teacher | Saved Attendance on this Phone (`Saved Attendance` / `এই ফোনে Saved Attendance`) | 100% EN/Bengalish | Clear sync action button, zero DB jargon |
| `/app/school-admin` | School Admin | School Overview (`Overview` / `Overview`) | 100% EN/Bengalish | 3 clean stat cards + 4 large action cards |
| `/app/school-admin/users` | School Admin | School Staff Directory (`School Staff` / `School Staff`) | 100% EN/Bengalish | Accessible modals, confirmation dialogs |
| `/app/school-admin/students` | School Admin | Student Roster (`Students` / `Students`) | 100% EN/Bengalish | Step-by-step add/import, roll number search |
| `/app/school-admin/academics` | School Admin | Classes & Sections (`Classes & Sections` / `Classes & Sections`) | 100% EN/Bengalish | Simple add class/year modals |
| `/app/school-admin/attendance` | School Admin | Daily Attendance Review (`Daily Attendance` / `Daily Attendance`) | 100% EN/Bengalish | Correction modal with reason audit log |
| `/app/school-admin/notifications`| School Admin | Parent Messages (`Parent Messages` / `Parent Messages`) | 100% EN/Bengalish | One-tap retry failed messages |
| `/app/rfid-operator` | Gate Operator | School Gate Attendance (`School Gate` / `School Gate`) | 100% EN/Bengalish | Real-time arrival feed, clear status |
| `/app/reports` | Report Viewer | Reports & Analytics (`Reports & Analytics` / `Reports & Analytics`) | 100% EN/Bengalish | Truthful live turnout gauge, zero fake data |
| `/app/reports/daily` | Report Viewer | Daily Roll Sheet (`Daily Roll` / `Daily Log`) | 100% EN/Bengalish | Mid-day meal headcount & print layout |
| `/app/reports/trends` | Report Viewer | Monthly Turnout Trends (`Monthly Trends` / `Monthly Trends`) | 100% EN/Bengalish | 7-day / 30-day selector, absentee patterns |
| `/app/reports/exports` | Report Viewer | Download Official Reports (`Export & Download` / `Export & Download`) | 100% EN/Bengalish | One-click CSV and Excel downloads |

---

## 2. Shared Layout Audit

- **TopBar (`src/layouts/TopBar.tsx`)**:
  - Offline sync status pill shows plain English/Bengalish ("Internet Connected" / "ইন্টারনেট Connected — Attendance এই ফোনে Safe আছে").
  - School switcher and role badge clearly identifiable.
  - Language toggle accessible in 1 tap (`EN` / `বাং + EN`).
- **Sidebar & Mobile Navigation (`src/layouts/Sidebar.tsx`, `MobileNavigation.tsx`)**:
  - Filtered by active role.
  - Touch targets $\ge 48\text{px}$ on mobile bottom navigation bar.
  - Active route highlighted with forest green accent.
