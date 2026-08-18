import { sql } from 'drizzle-orm';
import { db } from '../db';

export type CalendarClassification =
  | 'WORKING_DAY'
  | 'SUNDAY_WEEKEND'
  | 'GOVERNMENT_HOLIDAY'
  | 'SCHOOL_HOLIDAY'
  | 'VACATION'
  | 'EXAMINATION_DAY'
  | 'EMERGENCY_CLOSURE'
  | 'OPTIONAL_WORKING_DAY';

export type CalendarSourceType =
  | 'SCHOOL_CONFIRMED'
  | 'DEPARTMENT_ORDER'
  | 'LEGACY_UNVERIFIED'
  | 'SYSTEM_TEMPLATE';

export interface CalendarDayInput {
  calendarDate: string;
  classification: CalendarClassification;
  reason?: string;
  isWorkingDay?: boolean;
  sourceType?: CalendarSourceType;
  sourceReference?: string;
  isApproximate?: boolean;
  createdBy?: string;
}

export interface CalendarVersion {
  id: string;
  schoolId: string;
  academicYear: number;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
  sourceType: CalendarSourceType;
  sourceReference: string | null;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

const NON_WORKING_CLASSIFICATIONS = new Set<CalendarClassification>([
  'SUNDAY_WEEKEND',
  'GOVERNMENT_HOLIDAY',
  'SCHOOL_HOLIDAY',
  'VACATION',
  'EMERGENCY_CLOSURE',
]);

function toVersion(row: any): CalendarVersion {
  return {
    id: String(row.id),
    schoolId: String(row.school_id),
    academicYear: Number(row.academic_year),
    version: Number(row.version),
    status: row.status,
    sourceType: row.source_type,
    sourceReference: row.source_reference ?? null,
    notes: row.notes ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
  };
}

function defaultWorkingDay(classification: CalendarClassification): boolean {
  return !NON_WORKING_CLASSIFICATIONS.has(classification);
}

function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error('CALENDAR_DATE_INVALID');
  }
}

async function getOrCreateDraftVersion(
  schoolId: string,
  year: number,
  createdBy?: string,
  sourceType: CalendarSourceType = 'SCHOOL_CONFIRMED',
  sourceReference?: string
): Promise<CalendarVersion> {
  const existing = await db.execute(sql`
    SELECT * FROM academic_calendar_versions
    WHERE school_id = ${schoolId}::uuid AND academic_year = ${year} AND status = 'DRAFT'
    ORDER BY version DESC LIMIT 1
  `);
  const row = (existing.rows as any[])[0];
  if (row) return toVersion(row);

  const created = await db.execute(sql`
    INSERT INTO academic_calendar_versions (
      school_id, academic_year, version, status, source_type,
      source_reference, created_by
    )
    SELECT
      ${schoolId}::uuid,
      ${year},
      COALESCE(MAX(version), 0) + 1,
      'DRAFT',
      ${sourceType},
      ${sourceReference || null},
      ${createdBy || null}::uuid
    FROM academic_calendar_versions
    WHERE school_id = ${schoolId}::uuid AND academic_year = ${year}
    RETURNING *
  `);
  const createdRow = (created.rows as any[])[0];
  if (!createdRow) throw new Error('CALENDAR_DRAFT_CREATE_FAILED');
  return toVersion(createdRow);
}

export async function listCalendarVersions(schoolId: string, year: number): Promise<CalendarVersion[]> {
  const result = await db.execute(sql`
    SELECT * FROM academic_calendar_versions
    WHERE school_id = ${schoolId}::uuid AND academic_year = ${year}
    ORDER BY version DESC
  `);
  return (result.rows as any[]).map(toVersion);
}

export async function getCalendarDays(
  schoolId: string,
  startDate: string,
  endDate: string,
  requestedVersionId?: string
) {
  assertDate(startDate);
  assertDate(endDate);
  const result = await db.execute(sql`
    WITH selected_version AS (
      SELECT v.*
      FROM academic_calendar_versions v
      WHERE v.school_id = ${schoolId}::uuid
        AND (${requestedVersionId || null}::uuid IS NULL OR v.id = ${requestedVersionId || null}::uuid)
        AND (
          ${requestedVersionId || null}::uuid IS NOT NULL
          OR v.status IN ('DRAFT', 'APPROVED')
        )
      ORDER BY
        CASE WHEN v.status = 'DRAFT' THEN 0 ELSE 1 END,
        v.version DESC
      LIMIT 1
    )
    SELECT
      d.id, d.calendar_date, d.classification, d.reason, d.is_working_day,
      d.source_type, d.source_reference, d.is_approximate, d.created_at,
      v.id AS version_id, v.version, v.status AS version_status,
      v.academic_year, v.approved_by, v.approved_at
    FROM academic_calendar_days d
    JOIN selected_version v ON v.id = d.calendar_version_id
    WHERE d.school_id = ${schoolId}::uuid
      AND d.calendar_date BETWEEN ${startDate}::date AND ${endDate}::date
    ORDER BY d.calendar_date
  `);
  const rows = result.rows as any[];
  const first = rows[0];
  return {
    version: first
      ? {
          id: first.version_id,
          version: Number(first.version),
          status: first.version_status,
          academicYear: Number(first.academic_year),
          approvedBy: first.approved_by ?? null,
          approvedAt: first.approved_at ? new Date(first.approved_at).toISOString() : null,
        }
      : null,
    days: rows.map((row) => ({
      id: row.id,
      calendarDate: String(row.calendar_date),
      classification: row.classification,
      reason: row.reason,
      isWorkingDay: row.is_working_day,
      sourceType: row.source_type,
      sourceReference: row.source_reference,
      isApproximate: row.is_approximate,
      createdAt: row.created_at,
    })),
  };
}

export async function upsertCalendarDay(schoolId: string, input: CalendarDayInput) {
  assertDate(input.calendarDate);
  const year = Number(input.calendarDate.slice(0, 4));
  const version = await getOrCreateDraftVersion(
    schoolId,
    year,
    input.createdBy,
    input.sourceType || 'SCHOOL_CONFIRMED',
    input.sourceReference
  );
  const isWorkingDay = input.isWorkingDay ?? defaultWorkingDay(input.classification);
  const result = await db.execute(sql`
    INSERT INTO academic_calendar_days (
      school_id, calendar_version_id, calendar_date, classification, reason,
      is_working_day, source_type, source_reference, is_approximate, created_by
    ) VALUES (
      ${schoolId}::uuid,
      ${version.id}::uuid,
      ${input.calendarDate}::date,
      ${input.classification},
      ${input.reason || null},
      ${isWorkingDay},
      ${input.sourceType || 'SCHOOL_CONFIRMED'},
      ${input.sourceReference || null},
      ${input.isApproximate ?? false},
      ${input.createdBy || null}::uuid
    )
    ON CONFLICT (school_id, calendar_version_id, calendar_date) DO UPDATE SET
      classification = EXCLUDED.classification,
      reason = EXCLUDED.reason,
      is_working_day = EXCLUDED.is_working_day,
      source_type = EXCLUDED.source_type,
      source_reference = EXCLUDED.source_reference,
      is_approximate = EXCLUDED.is_approximate,
      updated_at = now()
    RETURNING *
  `);
  return { version, day: (result.rows as any[])[0] };
}

export async function bulkSetDateRange(
  schoolId: string,
  input: Omit<CalendarDayInput, 'calendarDate'> & { startDate: string; endDate: string }
) {
  assertDate(input.startDate);
  assertDate(input.endDate);
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(`${input.endDate}T00:00:00Z`);
  if (end < start) throw new Error('CALENDAR_RANGE_INVALID');
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount > 370) throw new Error('CALENDAR_RANGE_LIMIT_EXCEEDED');

  let count = 0;
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    await upsertCalendarDay(schoolId, {
      ...input,
      calendarDate: cursor.toISOString().slice(0, 10),
    });
    count += 1;
  }
  return { count };
}

export interface DefaultHoliday {
  date: string;
  classification: CalendarClassification;
  reason: string;
  isApproximate: boolean;
  sourceReference: string;
}

export function getDefaultWestBengalHolidays(year: number): DefaultHoliday[] {
  const exact = (monthDay: string, reason: string): DefaultHoliday => ({
    date: `${year}-${monthDay}`,
    classification: 'GOVERNMENT_HOLIDAY',
    reason,
    isApproximate: false,
    sourceReference: 'Fixed annual date; verify against the applicable department order before approval',
  });
  const proposed = (monthDay: string, reason: string): DefaultHoliday => ({
    date: `${year}-${monthDay}`,
    classification: 'SCHOOL_HOLIDAY',
    reason: `${reason} (proposed date — confirmation required)`,
    isApproximate: true,
    sourceReference: 'System planning template only; replace with the exact date from the applicable department order',
  });

  return [
    exact('01-26', 'Republic Day'),
    proposed('02-03', 'Saraswati Puja / Vasant Panchami'),
    proposed('03-14', 'Doljatra / Holi'),
    proposed('04-15', 'Bengali New Year'),
    proposed('04-18', 'Good Friday'),
    proposed('05-09', 'Rabindra Jayanti'),
    proposed('05-12', 'Buddha Purnima'),
    proposed('05-31', 'Eid-ul-Fitr'),
    proposed('06-07', 'Bakrid / Eid-ul-Adha'),
    proposed('07-06', 'Muharram'),
    exact('08-15', 'Independence Day'),
    proposed('08-16', 'Janmashtami'),
    proposed('09-21', 'Mahalaya'),
    proposed('09-26', 'Durga Puja / Maha Panchami'),
    proposed('09-27', 'Durga Puja / Maha Shasthi'),
    proposed('09-28', 'Durga Puja / Maha Saptami'),
    proposed('09-29', 'Durga Puja / Maha Ashtami'),
    proposed('09-30', 'Durga Puja / Maha Navami'),
    proposed('10-01', 'Durga Puja / Bijoya Dashami'),
    exact('10-02', 'Gandhi Jayanti'),
    proposed('10-06', 'Lakshmi Puja'),
    proposed('10-20', 'Kali Puja / Diwali'),
    proposed('10-22', 'Bhai Phonta'),
    proposed('10-27', 'Chhath Puja'),
    proposed('11-05', 'Guru Nanak Jayanti'),
    exact('12-25', 'Christmas Day'),
  ];
}

export async function populateDefaultWestBengalHolidays(
  schoolId: string,
  year: number,
  createdBy?: string
) {
  const holidays = getDefaultWestBengalHolidays(year);
  for (const holiday of holidays) {
    await upsertCalendarDay(schoolId, {
      calendarDate: holiday.date,
      classification: holiday.classification,
      reason: holiday.reason,
      isWorkingDay: false,
      isApproximate: holiday.isApproximate,
      sourceType: 'SYSTEM_TEMPLATE',
      sourceReference: holiday.sourceReference,
      createdBy,
    });
  }
  const draft = (await listCalendarVersions(schoolId, year)).find((version) => version.status === 'DRAFT');
  return {
    importedCount: holidays.length,
    approximateCount: holidays.filter((holiday) => holiday.isApproximate).length,
    calendarVersion: draft || null,
    activationRequired: true,
  };
}

export async function approveCalendarVersion(
  schoolId: string,
  versionId: string,
  approvedBy: string,
  sourceReference: string
): Promise<CalendarVersion> {
  if (!sourceReference.trim()) throw new Error('CALENDAR_SOURCE_REFERENCE_REQUIRED');
  return db.transaction(async (tx) => {
    const selected = await tx.execute(sql`
      SELECT * FROM academic_calendar_versions
      WHERE id = ${versionId}::uuid AND school_id = ${schoolId}::uuid
      FOR UPDATE
    `);
    const row = (selected.rows as any[])[0];
    if (!row) throw new Error('CALENDAR_VERSION_NOT_FOUND');
    if (row.status !== 'DRAFT') throw new Error('CALENDAR_VERSION_NOT_DRAFT');

    const blockers = await tx.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM academic_calendar_days
      WHERE school_id = ${schoolId}::uuid
        AND calendar_version_id = ${versionId}::uuid
        AND is_approximate = true
    `);
    if (Number((blockers.rows as any[])[0]?.count || 0) > 0) {
      throw new Error('CALENDAR_APPROXIMATE_DATES_REQUIRE_CONFIRMATION');
    }

    await tx.execute(sql`
      UPDATE academic_calendar_versions
      SET status = 'SUPERSEDED', superseded_at = now()
      WHERE school_id = ${schoolId}::uuid
        AND academic_year = ${Number(row.academic_year)}
        AND status = 'APPROVED'
    `);
    const approved = await tx.execute(sql`
      UPDATE academic_calendar_versions
      SET status = 'APPROVED', approved_by = ${approvedBy}::uuid,
        approved_at = now(), source_reference = ${sourceReference}
      WHERE id = ${versionId}::uuid AND school_id = ${schoolId}::uuid
      RETURNING *
    `);
    return toVersion((approved.rows as any[])[0]);
  });
}

export async function getCalendarCoverageStatus(
  schoolId: string,
  startDate: string,
  endDate: string
) {
  assertDate(startDate);
  assertDate(endDate);
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const result = await db.execute(sql`
    SELECT academic_year, id, version, source_reference, approved_at
    FROM academic_calendar_versions
    WHERE school_id = ${schoolId}::uuid
      AND status = 'APPROVED'
      AND academic_year BETWEEN ${startYear} AND ${endYear}
    ORDER BY academic_year
  `);
  const approvedYears = new Set((result.rows as any[]).map((row) => Number(row.academic_year)));
  const missingYears: number[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    if (!approvedYears.has(year)) missingYears.push(year);
  }
  return { complete: missingYears.length === 0, missingYears, approvedVersions: result.rows };
}

export async function getWorkingDaysMap(
  schoolId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, { isWorkingDay: boolean; classification: CalendarClassification; reason?: string }>> {
  assertDate(startDate);
  assertDate(endDate);
  const result = await db.execute(sql`
    SELECT d.calendar_date, d.classification, d.reason, d.is_working_day
    FROM academic_calendar_days d
    JOIN academic_calendar_versions v ON v.id = d.calendar_version_id
    WHERE d.school_id = ${schoolId}::uuid
      AND v.status = 'APPROVED'
      AND d.calendar_date BETWEEN ${startDate}::date AND ${endDate}::date
    ORDER BY d.calendar_date
  `);

  const explicit = new Map<string, { isWorkingDay: boolean; classification: CalendarClassification; reason?: string }>();
  for (const row of result.rows as any[]) {
    explicit.set(String(row.calendar_date), {
      isWorkingDay: Boolean(row.is_working_day),
      classification: row.classification,
      reason: row.reason || undefined,
    });
  }

  const output = new Map<string, { isWorkingDay: boolean; classification: CalendarClassification; reason?: string }>();
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const configured = explicit.get(date);
    output.set(
      date,
      configured || {
        isWorkingDay: cursor.getUTCDay() !== 0,
        classification: cursor.getUTCDay() === 0 ? 'SUNDAY_WEEKEND' : 'WORKING_DAY',
        reason: cursor.getUTCDay() === 0 ? 'Sunday' : undefined,
      }
    );
  }
  return output;
}
