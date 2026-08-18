# Academic Calendar and Working-Day Governance

## Purpose

Attendance denominators depend on whether each school date is a working day. Calendar data must therefore be reviewed rather than silently assumed. The system does not describe a template, imported list, or approximate movable holiday as an official government calendar.

## Version lifecycle

Each school and academic year can have versioned calendars:

- `DRAFT` — editable and not authoritative;
- `APPROVED` — active for reporting after review;
- `SUPERSEDED` — retained as history after a newer version is approved.

Approving a draft supersedes the prior approved version for that school and academic year. Reports snapshot the selected calendar version so later calendar edits do not rewrite the history of an existing artifact.

## Source provenance

Calendar versions and days record a source type:

- `SCHOOL_CONFIRMED` — reviewed against the school's authorized source;
- `DEPARTMENT_ORDER` — entered from a referenced departmental order;
- `LEGACY_UNVERIFIED` — migrated data whose provenance was not established;
- `SYSTEM_TEMPLATE` — generated starting point that requires school review.

Use `sourceReference` for an order number, circular, meeting resolution, or other traceable citation. A source label records provenance; it does not cause the software to independently verify the source.

## Approximate dates

Movable holidays and imported estimates must set `isApproximate=true`. A calendar version containing any approximate day cannot be approved. A reviewer must confirm or correct each date and update the entry to `isApproximate=false` before approval.

This protects reports from treating guessed dates as authoritative.

## Day classifications

| Classification | Default meaning |
|---|---|
| `WORKING_DAY` | Standard instructional day |
| `SUNDAY_WEEKEND` | Weekly non-working day |
| `GOVERNMENT_HOLIDAY` | Holiday entered from a referenced authority source |
| `SCHOOL_HOLIDAY` | School-declared holiday |
| `VACATION` | Scheduled vacation |
| `EXAMINATION_DAY` | Examination day; set `isWorkingDay` to the school's reviewed policy |
| `EMERGENCY_CLOSURE` | Unscheduled closure |
| `OPTIONAL_WORKING_DAY` | Reviewed special working day |

`isWorkingDay` is stored explicitly. Reports use the reviewed flag rather than inferring it only from the label.

## Review procedure

1. Create or import a `DRAFT` version for one academic year.
2. Enter `sourceType` and a meaningful `sourceReference`.
3. Review every day classification and working-day flag.
4. Resolve every approximate date.
5. Check that emergency closures, vacations, weekends, examinations, and special working days reflect the school's records.
6. Approve the version as a `SCHOOL_ADMIN` or `HEAD_TEACHER`.
7. Generate a validation preview and review any remaining missing-calendar warning before producing a report.

## Reporting behavior

- Approved working days contribute to the working-day count.
- Approved non-working days do not create absence rows.
- Attendance sessions cancelled by the school are not counted as finalized attendance.
- Unmarked working days remain visible as warnings or missing-data rows.
- If a period crosses academic years, the service resolves each year's approved calendar independently.
- If no approved version exists, validation reports the gap instead of calling an unreviewed template official.

## Legacy data

Migration preserves prior calendar rows by associating them with a `LEGACY_UNVERIFIED` version. This preserves records without overstating their authority. Review and replace legacy versions before relying on them for new operational reporting.

## Claim boundary

The calendar workflow provides versioning, provenance, review, and technical enforcement. It does not supply legal advice or automatically establish that a date list is the current official calendar for a state or education authority.