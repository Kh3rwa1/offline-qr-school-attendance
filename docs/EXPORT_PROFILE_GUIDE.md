# Export Profile Configuration Guide

## Purpose

Export Profiles provide school administrators with fine-grained control over report layout, included columns, signature blocks, localized labels, and institutional disclaimers.

---

## 1. Profile Schema (`reporting_profiles` Table)

Each profile defines formatting rules stored as structured JSON in the database:

- `profile_name`: Identifies the profile (e.g. `West Bengal Management Register v1.0.0`).
- `layout_type`: `PORTRAIT` or `LANDSCAPE`.
- `columns_json`: Array of columns enabled for the report:
  - `roll_number`
  - `student_code`
  - `banglar_shiksha_id`
  - `name_en`
  - `name_bn`
  - `gender`
  - `daily_grid`
  - `totals_p_l_a_e`
  - `working_days`
  - `attendance_rate`
  - `guardian_phone` (Disabled by default for student privacy)
- `signatures_json`: Array of designated signature blocks:
  - `Class Teacher`
  - `Report Verification In-Charge`
  - `Headmaster / Teacher-in-Charge`
- `disclaimer_text`: Standard non-certification legal disclaimer.
- `version`: Incremental integer tracking profile revisions.

---

## 2. API Endpoints

### Fetch Reporting Profiles
```http
GET /api/v1/schools/{schoolId}/reports/profiles
```

### Response
```json
{
  "profiles": [
    {
      "id": "78a9c2f1-...",
      "profileName": "West Bengal Management Register v1.0.0",
      "isDefault": true,
      "layoutType": "LANDSCAPE",
      "columns": [
        "roll_number",
        "student_code",
        "banglar_shiksha_id",
        "name_en",
        "name_bn",
        "daily_grid",
        "totals_p_l_a_e",
        "working_days",
        "attendance_rate"
      ],
      "version": 1
    }
  ]
}
```
