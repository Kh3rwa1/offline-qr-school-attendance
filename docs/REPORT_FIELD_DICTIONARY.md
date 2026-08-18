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
| `Banglar Shiksha ID` | student profile | Optional school-entered reference; blank when unavailable. Its presence is not independently verified by the application. |
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