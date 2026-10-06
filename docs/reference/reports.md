---
title: "Internal Attendance Report Field Dictionary"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# Internal Attendance Report Field Dictionary

This dictionary describes the implemented internal school-management exports. It is not a government data dictionary and does not establish portal compatibility.

## Attendance status codes

| Code | Source status | Counts as attended | Meaning |
|---|---|---:|---|
| `P` | `PRESENT` | Yes | Student recorded as present in a finalized session. |
| `L` | `LATE` | Yes | Student recorded as late in a finalized session. |
| `A` | `ABSENT` | No | Student recorded as absent on an applicable working day. |
| `E` | `EXCUSED` | No | Student has an excused/leave status. It remains visible and is not silently treated as present. |
| `U` | no finalized mark | No | Session or student entry is pending/missing. |
| `H` | approved non-working date | Excluded | Reviewed holiday or closure. |
| `W` | approved weekend date | Excluded | Reviewed weekly non-working date. |

A non-working date is determined by the approved calendar snapshot, not merely by its display code.

## Student identification fields

| Export heading | Source | Notes |
|---|---|---|
| `Roll` | active enrollment | Class/section roll number; may be blank if the school has not assigned one. |
| `Student ID` | student code | Internal school identifier, not a government identifier. |
| `Banglar Shiksha ID` | student profile | Optional school-entered reference; blank when unavailable. Its presence is entered by school staff and is not validated by external systems. |
| `Student Name` | student profile | English/default name. |
| `Student Name (বাংলা)` | student profile | Optional Bengali-script name. |
| `Class` | class section | School-defined class name. |
| `Section` | class section | School-defined section name. |

Guardian contact data and credentials are excluded from the built-in profile.

## Period and calendar fields

| Field | Meaning |
|---|---|
| `Period Start` / `Period End` | Inclusive ISO calendar dates requested by the user. |
| `Applicable Working Days` | Approved calendar dates in the range whose stored `isWorkingDay` value is true. |
| `Finalized Sessions` | Attendance sessions in the selected scope and period with a finalized state. |
| `Unmarked Entries` | Expected student/date entries without a finalized attendance mark. |
| `Calendar Version` | Approved version selected for the relevant academic year, snapshotted at generation. |
| `Calendar Source` | Recorded provenance label and reference; not independent source verification. |

## Summary calculations

For an individual row:

```text
Attended = Present + Late
Recorded denominator = Present + Late + Absent + Excused
Attendance rate = Attended / Recorded denominator × 100
```

If the denominator is zero, the rate is rendered as zero rather than `NaN` or infinity. Unmarked entries are reported separately and are not silently converted to absence.

School-wide totals aggregate the same row counts within the validated scope. Reports should be reviewed when validation warns about unmarked sessions or missing approved calendar dates.

## Report lifecycle fields

| Field | Meaning |
|---|---|
| `VALIDATED` | Request passed blocking validation but has no stored artifact yet. |
| `READY_FOR_REVIEW` | Immutable artifact exists and can be reviewed. |
| `APPROVED_INTERNALLY` | Authorized school reviewer approved that exact artifact. |
| `SUPERSEDED` | A newer internal version replaced it; historical bytes remain stored. |
| `Report ID` | UUID of the internal report record. |
| `Artifact ID` | UUID of the immutable stored payload. |
| `Profile Version` | Profile label snapshotted at generation. |
| `SHA-256` | Digest of the exact downloadable bytes. |
| `Byte Size` | Stored payload length. |

`APPROVED_INTERNALLY` is not government certification.

## File-level rules

- `.xlsx` artifacts use the OpenXML workbook binary signature and Excel MIME type.
- `.csv` artifacts are UTF-8 with BOM and text/csv MIME type.
- `.html` artifacts are standalone escaped HTML documents and text/html MIME type.
- Filename, extension, MIME type, and content signature must agree.
- Spreadsheet-formula-like text is prefixed with a single quote.
- Repeated downloads return the same stored bytes and digest.


## Export Profiles

# Reporting Profile Guide

## Purpose

A reporting profile is a versioned layout and localization contract for internal attendance exports. It controls visible labels, column order, signature captions, document orientation, and the non-certification disclaimer. It does not make an export an authority-issued form.

## Built-in profile

Migration installs a global, read-only fallback profile with UUID:

```text
00000000-0000-4000-8000-000000000070
```

The built-in profile provides English, Bengali, and Hindi labels and disclaimers. It is used only when the school has no active default profile or when the caller does not select another accessible profile.

## Stored fields

A `reporting_profiles` row contains:

- `schoolId` — school-owned profiles use their tenant ID; the built-in fallback has no school ID;
- `profileName` — human-readable name;
- `version` — immutable version label copied into every generated report;
- `isDefault` and `isActive` — selection controls;
- `configuration` — JSON configuration validated by the server;
- `createdAt` and `updatedAt` — administrative timestamps.

The configuration contract includes:

```json
{
  "language": "BILINGUAL",
  "orientation": "LANDSCAPE",
  "columns": ["roll", "studentCode", "studentName", "studentNameBn"],
  "labels": {
    "en": { "title": "Attendance Register" },
    "bn": { "title": "হাজিরা রেজিস্টার" },
    "hi": { "title": "उपस्थिति रजिस्टर" }
  },
  "signatureBlocks": ["Class Teacher", "Head Teacher"],
  "disclaimer": {
    "en": "Internal school-management report; not government certification or proof of portal submission.",
    "bn": "বিদ্যালয়ের অভ্যন্তরীণ ব্যবস্থাপনা রিপোর্ট; সরকারি সার্টিফিকেশন বা পোর্টালে জমার প্রমাণ নয়।",
    "hi": "विद्यालय की आंतरिक प्रबंधन रिपोर्ट; सरकारी प्रमाणन या पोर्टल जमा करने का प्रमाण नहीं।"
  }
}
```

The exact allowed column keys are defined in `src/services/reportProfileService.ts`. Unknown or malformed configuration is rejected rather than guessed.

## Resolution order

1. If the request names a profile, it must be active and accessible to the active school.
2. Otherwise the service looks for the school's active default profile.
3. Otherwise it uses the built-in global fallback profile.
4. If no valid profile can be resolved, generation stops with a configuration error.

Tenant RLS permits schools to read their own profiles and the global fallback. A school cannot select another school's profile UUID.

## Snapshot and reproducibility

Generation stores all of the following with the immutable report artifact:

- profile ID;
- profile version;
- complete effective configuration snapshot.

Changing or deactivating a profile later does not change old artifacts. Generate a new report to use a revised profile.

## API

List profiles visible to the active school:

```http
GET /api/v1/schools/{schoolId}/reports/profiles
```

The response returns a `profiles` array with ID, name, version, default state, and effective configuration. Profile selection is available in the report wizard.

This release does not claim a complete profile-design UI. School-specific profile creation and review should use an authorized administrative provisioning process until that UI is implemented.

## Privacy review

Do not add guardian phone numbers, credentials, national identifiers, medical notes, or other sensitive fields merely because they are available in the database. Before enabling a new field, record:

- why the field is necessary;
- who may receive the export;
- how long the artifact is retained;
- how printed and downloaded copies are protected.


## Official Reporting Specifications

<!-- claims-allow: gov, cert, guarantee | explicit disclaimer stating application does not certify compliance or guarantee authority acceptance -->
> **Scope statement:** These exports are for a school's internal administration and record keeping. The application does **not** certify government compliance, submit data to a government portal, guarantee acceptance by any authority, or replace an authority-issued template. A school's authorized reviewer remains responsible for checking every report before use outside the school.

The historical filename is retained to avoid breaking documentation links. The feature itself is described as **internal school-management reporting** throughout the application.

## What is implemented

- A six-step accessible report wizard plus a one-click current-month Excel action.
- Report types with distinct row sets and layouts:
  - monthly register;
  - daily class register;
  - whole-school daily summary;
  - academic-year register;
  - custom date-range register;
  - absentee report;
  - consecutive-absence report;
  - corrections report;
  - missing-data report;
  - complete internal package.
- Scopes for the whole school, all classes, selected classes, one section, selected students, or one student.
- Real `.xlsx`, UTF-8 `.csv`, and standalone printable `.html` artifacts.
- English, Bengali, and Hindi labels and disclaimers through a versioned reporting profile.
- Pre-generation validation for tenant ownership, selected scope, date bounds, estimated output size, calendar approval, session finalization, and unmarked data.
- Bounded in-process generation with configurable concurrency and queue capacity.
- Immutable stored artifacts with filename, content type, byte length, SHA-256 digest, profile snapshot, calendar-version snapshot, and report-input snapshot.
- Byte-identical repeated downloads from stored bytes; downloads do not regenerate reports from live attendance data.
- Internal lifecycle states: `VALIDATED`, `READY_FOR_REVIEW`, `APPROVED_INTERNALLY`, and `SUPERSEDED`.

## Workflow

1. **Choose report type.** The choice changes the exported columns and rows; the labels are not aliases for one generic output.
2. **Choose scope.** Every selected class and student ID is checked against the active school. Empty selected scopes and cross-school identifiers are rejected.
3. **Choose period.** The API enforces a bounded inclusive date range. Dates are interpreted as school calendar dates rather than browser-local timestamps.
4. **Choose format and profile.** The chosen profile version and effective configuration are snapshotted for reproducibility.
5. **Review validation.** Blocking errors prevent generation. Warnings remain visible but do not falsely imply official approval.
6. **Generate and download.** The exact bytes are stored first, then returned through an authenticated artifact endpoint. The response includes the digest and byte size.

## File contracts

| Format | Extension | Content type | Implementation |
|---|---|---|---|
| Excel | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | OpenXML workbook readable by Excel and LibreOffice |
| CSV | `.csv` | `text/csv; charset=utf-8` | UTF-8 with BOM, quoted fields, localized headings, spreadsheet-formula protection |
| HTML | `.html` | `text/html; charset=utf-8` | Escaped standalone document with printable tables and disclaimer |

An artifact is rejected if its requested format, extension, MIME type, or binary signature do not agree.

## Integrity model

The SHA-256 value is calculated over the exact stored bytes after export generation. It is returned by the API and stored beside the artifact. The digest is intentionally **not inserted back into the same file after hashing**, because doing that would change the bytes and invalidate the digest.

The download endpoint reads the stored artifact; it never rebuilds from current rows. If attendance changes later, create a new report version. Previously generated bytes and their digest remain unchanged.

## Calendar dependency

Only an `APPROVED` calendar version is authoritative for working/non-working-day classification. Imported or templated dates that are approximate remain `DRAFT` and cannot become active until a reviewer confirms each approximate entry and approves the version. Missing approval produces a visible validation warning; the export never silently describes an unverified calendar as official.

## Roles and review

Authenticated school members with `SCHOOL_ADMIN`, `HEAD_TEACHER`, `TEACHER`, or `REPORT_VIEWER` membership can validate and generate within the active school, subject to teacher-assignment scope. Only `SCHOOL_ADMIN` or `HEAD_TEACHER` can internally approve or supersede a report.

`APPROVED_INTERNALLY` means that an authorized school member reviewed the stored artifact. It does not mean government approval.

## Operational limits

Defaults can be changed with reporting environment variables:

- maximum artifact bytes;
- maximum period days;
- maximum students;
- maximum estimated cells;
- generation concurrency;
- pending queue length;
- database or local-filesystem artifact storage.

Local filesystem storage is suitable only when the artifact directory is on durable, backed-up storage and is available to every application replica that may serve a download. Database storage is the default.

## Evidence boundary

Automated tests provide evidence for format signatures, Unicode round trips, formula protection, HTML escaping, tenant isolation, lifecycle enforcement, calendar review, output bounds, exact persisted bytes, repeated-byte identity, and SHA-256 correctness. They do not provide evidence of acceptance by a real government portal, legal certification, or external object-storage operation.