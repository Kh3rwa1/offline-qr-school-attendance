import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { academicCalendarDays, schools } from '../db/schema';
import { createAuditLog } from './auditLogService';

export type CalendarClassification =
  | 'WORKING_DAY'
  | 'SUNDAY_WEEKEND'
  | 'GOVERNMENT_HOLIDAY'
  | 'SCHOOL_HOLIDAY'
  | 'VACATION'
  | 'EXAMINATION_DAY'
  | 'EMERGENCY_CLOSURE'
  | 'OPTIONAL_WORKING_DAY';

export interface CalendarDayRecord {
  id: string;
  schoolId: string;
  calendarDate: string; // YYYY-MM-DD
  classification: CalendarClassification;
  reason?: string | null;
  isWorkingDay: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DayWorkingStatus {
  dateStr: string;
  isWorkingDay: boolean;
  classification: CalendarClassification;
  reason?: string;
}

/**
 * Standard Gazetted West Bengal Holidays Generator
 */
export function getDefaultWestBengalHolidays(year: number): Array<{ date: string; name: string; classification: CalendarClassification }> {
  // Deterministic fixed and approximate gazetted dates for West Bengal
  return [
    { date: `${year}-01-01`, name: "New Year's Day", classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-01-23`, name: 'Netaji Subhas Chandra Bose Jayanti', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-01-26`, name: 'Republic Day', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-02-14`, name: 'Saraswati Puja (Shree Panchami)', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-03-25`, name: 'Doljatra / Holi', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-04-14`, name: 'Dr. B.R. Ambedkar Jayanti / Bengali New Year (Poila Baisakh)', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-04-18`, name: 'Good Friday', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-05-01`, name: 'May Day (Labor Day)', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-05-09`, name: 'Rabindra Jayanti', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-08-15`, name: 'Independence Day', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-08-26`, name: 'Janmashtami', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-10-02`, name: 'Mahatma Gandhi Jayanti', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-10-12`, name: 'Mahalaya', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-10-20`, name: 'Durga Puja (Maha Saptami)', classification: 'VACATION' },
    { date: `${year}-10-21`, name: 'Durga Puja (Maha Ashtami)', classification: 'VACATION' },
    { date: `${year}-10-22`, name: 'Durga Puja (Maha Nabami)', classification: 'VACATION' },
    { date: `${year}-10-23`, name: 'Durga Puja (Vijaya Dashami)', classification: 'VACATION' },
    { date: `${year}-10-28`, name: 'Lakshmi Puja', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-11-12`, name: 'Kali Puja / Diwali', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-11-14`, name: 'Bhai Dooj (Bhatridwitiya)', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-11-15`, name: 'Birsa Munda Jayanti', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-11-27`, name: 'Guru Nanak Jayanti', classification: 'GOVERNMENT_HOLIDAY' },
    { date: `${year}-12-25`, name: 'Christmas Day', classification: 'GOVERNMENT_HOLIDAY' },
  ];
}

/**
 * Fetch configured calendar days for a school in a date range
 */
export async function getCalendarDays(
  schoolId: string,
  startDate: string,
  endDate: string
): Promise<CalendarDayRecord[]> {
  const records = await db
    .select()
    .from(academicCalendarDays)
    .where(
      and(
        eq(academicCalendarDays.schoolId, schoolId),
        gte(academicCalendarDays.calendarDate, startDate),
        lte(academicCalendarDays.calendarDate, endDate)
      )
    )
    .orderBy(academicCalendarDays.calendarDate);

  return records as any;
}

/**
 * Upsert a single calendar day entry
 */
export async function upsertCalendarDay(
  schoolId: string,
  data: {
    calendarDate: string;
    classification: CalendarClassification;
    reason?: string;
    isWorkingDay?: boolean;
    createdBy?: string;
  }
): Promise<CalendarDayRecord> {
  const isWorking =
    data.isWorkingDay !== undefined
      ? data.isWorkingDay
      : data.classification === 'WORKING_DAY' ||
        data.classification === 'EXAMINATION_DAY' ||
        data.classification === 'OPTIONAL_WORKING_DAY';

  const [existing] = await db
    .select()
    .from(academicCalendarDays)
    .where(
      and(
        eq(academicCalendarDays.schoolId, schoolId),
        eq(academicCalendarDays.calendarDate, data.calendarDate)
      )
    );

  let result: any;
  if (existing) {
    [result] = await db
      .update(academicCalendarDays)
      .set({
        classification: data.classification,
        reason: data.reason || null,
        isWorkingDay: isWorking,
        updatedAt: new Date(),
      })
      .where(eq(academicCalendarDays.id, existing.id))
      .returning();
  } else {
    [result] = await db
      .insert(academicCalendarDays)
      .values({
        schoolId,
        calendarDate: data.calendarDate,
        classification: data.classification,
        reason: data.reason || null,
        isWorkingDay: isWorking,
        createdBy: data.createdBy || null,
      })
      .returning();
  }

  if (data.createdBy) {
    await createAuditLog({
      schoolId,
      actorId: data.createdBy,
      action: 'CALENDAR_DAY_UPDATED',
      resourceType: 'CALENDAR_DAY',
      resourceId: result.id,
      metadata: {
        calendarDate: data.calendarDate,
        classification: data.classification,
        isWorkingDay: isWorking,
        reason: data.reason,
      },
    });
  }

  return result;
}

/**
 * Bulk set a contiguous date range classification (e.g. Vacation, Exams)
 */
export async function bulkSetDateRange(
  schoolId: string,
  data: {
    startDate: string;
    endDate: string;
    classification: CalendarClassification;
    reason?: string;
    isWorkingDay?: boolean;
    createdBy?: string;
  }
): Promise<{ count: number }> {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  if (start > end) {
    throw new Error('startDate cannot be after endDate');
  }

  const isWorking =
    data.isWorkingDay !== undefined
      ? data.isWorkingDay
      : data.classification === 'WORKING_DAY' ||
        data.classification === 'EXAMINATION_DAY' ||
        data.classification === 'OPTIONAL_WORKING_DAY';

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    await upsertCalendarDay(schoolId, {
      calendarDate: dateStr,
      classification: data.classification,
      reason: data.reason,
      isWorkingDay: isWorking,
      createdBy: data.createdBy,
    });
    count++;
    current.setDate(current.getDate() + 1);
  }

  return { count };
}

/**
 * Populate default West Bengal Holidays for a year
 */
export async function populateDefaultWestBengalHolidays(
  schoolId: string,
  year: number,
  createdBy?: string
): Promise<{ importedCount: number }> {
  const holidays = getDefaultWestBengalHolidays(year);
  let importedCount = 0;

  for (const h of holidays) {
    await upsertCalendarDay(schoolId, {
      calendarDate: h.date,
      classification: h.classification,
      reason: h.name,
      isWorkingDay: false,
      createdBy,
    });
    importedCount++;
  }

  return { importedCount };
}

/**
 * Get classification map for all days in a date range
 * If a date is not in DB:
 *   - Sunday (day === 0) => SUNDAY_WEEKEND (isWorkingDay = false)
 *   - Mon-Sat => WORKING_DAY (isWorkingDay = true)
 */
export async function getWorkingDaysMap(
  schoolId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, DayWorkingStatus>> {
  const map = new Map<string, DayWorkingStatus>();
  const dbRecords = await getCalendarDays(schoolId, startDate, endDate);
  const recordByDate = new Map<string, CalendarDayRecord>();
  for (const r of dbRecords) {
    recordByDate.set(r.calendarDate, r);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const cur = new Date(start);

  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    const dayOfWeek = cur.getDay(); // 0 = Sunday

    if (recordByDate.has(dateStr)) {
      const rec = recordByDate.get(dateStr)!;
      map.set(dateStr, {
        dateStr,
        isWorkingDay: rec.isWorkingDay,
        classification: rec.classification,
        reason: rec.reason || undefined,
      });
    } else {
      if (dayOfWeek === 0) {
        map.set(dateStr, {
          dateStr,
          isWorkingDay: false,
          classification: 'SUNDAY_WEEKEND',
          reason: 'Sunday',
        });
      } else {
        map.set(dateStr, {
          dateStr,
          isWorkingDay: true,
          classification: 'WORKING_DAY',
          reason: undefined,
        });
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  return map;
}
