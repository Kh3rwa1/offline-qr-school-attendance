# User Acceptance Testing (UAT) Execution Pack — Rural West Bengal Pilot

> **CURRENT STATUS: UAT READY — NOT YET EXECUTED**
> 
> *Live field trial execution with human participants at selected rural primary/secondary schools in Bankura and Purulia districts is scheduled for field deployment. Automated simulation and unit suites have fully passed.*

---

## 1. Target User Personas & Test Cohort

| Participant ID | Role | Profile / Demographics | Language Preference | Device Used |
| :--- | :--- | :--- | :--- | :--- |
| **UAT-P1** | Primary Teacher | 56 years old, 30 years teaching experience, basic smartphone user | Bengalish (`বাংলা + English`) | Redmi 9A (Android 10, 360px width) |
| **UAT-P2** | Head Teacher (School Admin) | 52 years old, responsible for institutional compliance and mid-day meal audits | Bengalish (`বাংলা + English`) / English | Samsung Galaxy M12 (Android 11) |
| **UAT-P3** | School Gate Operator | 38 years old, non-teaching staff, manages gate arrival and badge cards | Bengalish (`বাংলা + English`) | Vivo Y15s (Android 12) |
| **UAT-P4** | District Report Viewer | 45 years old, district education inspector, reviews monthly turnout trends | English / Bengalish (`বাংলা + English`) | Chrome on Windows Laptop / Tablet |

---

## 2. Core Operational Scenarios

### Scenario 1: Teacher Daily Attendance (Offline Blackout)
1. Teacher switches phone to Airplane Mode (simulating rural power/network blackout).
2. Opens AttendEase, selects assigned Class 5-A.
3. Takes attendance using QR camera badge scans and touch-mark roll sheet.
4. Marks 28 students Present, 2 Late, 4 Absent.
5. Taps "Attendance Finish করুন" / "Finish Attendance" and confirms the prompt.
6. Reconnects to network and verifies that "Saved Records Send করুন" securely uploads all 34 records without duplicate errors.

### Scenario 2: School Headmaster Roster Setup & Corrections
1. Headmaster creates new class section "Class 6 - B".
2. Adds student with Banglar Shiksha ID and Bengali name.
3. Reviews today's Class 5-A attendance session and corrects 1 marked Absent student to Present with reason "Arrived on late bus".
4. Verifies audit trail records correction.

### Scenario 3: Gate Operator Badge Assignment & Arrival Monitoring
1. Gate operator searches student "Subrata Mondal" by roll number.
2. Taps "Badge দিন" / "Give Badge" and scans new RFID card token.
3. Verifies student arrival appears immediately in "আজ কারা এসেছে" / "Who Came In Today" live feed.

### Scenario 4: Official Report Export
1. Report Viewer opens Reports & Analytics dashboard.
2. Verifies truthful attendance score gauge.
3. Exports Monthly Attendance Register as `.xlsx` and verifies all columns format correctly for district submission.
