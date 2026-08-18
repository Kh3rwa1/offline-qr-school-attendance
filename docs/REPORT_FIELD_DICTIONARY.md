# Report Field Dictionary

This dictionary defines every field, metric, status code, and column used in the Government-Ready Reporting system.

---

## 1. Status Codes

| Code | Status Name | Classification | Counted in Attendance % | Description |
| :--- | :--- | :--- | :---: | :--- |
| **P** | Present | Regular Attendance | **Yes** (Numerator) | Student scanned at gate or marked present during roll call. |
| **L** | Late Arrival | Late Attendance | **Yes** (Numerator) | Student arrived after the standard cutoff time. |
| **A** | Absent | Non-Attendance | **No** (Denominator only) | Student did not attend on an applicable working day. |
| **E** | Excused / Leave | Approved Leave | **No** (Excluded or Denominator) | Student was absent due to approved medical or authorized leave. |
| **H** | Holiday | Non-Working Day | **Excluded** | Gazetted government or school holiday. |
| **W** | Weekend / Sunday | Non-Working Day | **Excluded** | Standard weekly non-working day. |
| **U** | Unmarked | Pending Session | **Excluded** | Attendance session not yet submitted or marked for this day. |

---

## 2. Calculated Summary Metrics

- **Total Students Enrolled**: Count of active student enrollments in the specified class section for the academic year.
- **Applicable Working Days**: Count of calendar days within the period where `isWorkingDay = true` and `sessionStatus != 'CANCELLED'`.
- **Total Present (P)**: Total count of days marked `PRESENT` for the student.
- **Total Late (L)**: Total count of days marked `LATE` for the student.
- **Total Absent (A)**: Total count of days marked `ABSENT` on applicable working days.
- **Total Leave (E)**: Total count of days with approved leave.
- **Attendance Rate (%)**:
  $$\text{Attendance Rate} = \frac{\text{Present} + \text{Late}}{\text{Applicable Working Days}} \times 100\%$$
- **Consecutive Absent Days**: Current unbroken streak of consecutive applicable working days marked `ABSENT`.

---

## 3. Student Identification Fields

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `Roll Number` | Integer | Class-specific roll number assigned for the academic year. |
| `Student ID` | String | Internal unique identifier (`STU-...`). |
| `Banglar Shiksha ID` | String | 14-digit West Bengal state education portal identifier. |
| `Student Name (EN)` | String | Student full name in English. |
| `Student Name (BN)` | String | Student full name in Bengali script (বাংলা). |
| `Gender` | String | Student gender (`Male`, `Female`, `Other`). |

---

## 4. Institutional Header & Certification Fields

- `School Name`: Full registered institutional name.
- `School Code / UDISE Code`: Unified District Information System for Education 11-digit code.
- `Circle / Sub-Division`: Administrative educational circle.
- `Block / Municipality`: Administrative block.
- `District`: Administrative district (e.g. Paschim Medinipur, Kolkata, Howrah).
- `State`: State of West Bengal.
- `Headmaster / Teacher-in-Charge Name`: Authorized institutional head.
- `Report Version`: Incremental integer (`v1`, `v2`, ...) indicating report revision.
- `SHA-256 Checksum`: Cryptographic 64-character hash of the generated report file for integrity verification.
