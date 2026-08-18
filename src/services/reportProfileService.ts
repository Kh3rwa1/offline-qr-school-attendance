import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { reportingProfiles } from '../db/schema';

const IncludeSheetsSchema = z.object({
  cover: z.boolean().default(true),
  summary: z.boolean().default(true),
  registers: z.boolean().default(true),
  absentees: z.boolean().default(true),
  consecutiveAbsences: z.boolean().default(true),
  corrections: z.boolean().default(true),
  calendar: z.boolean().default(true),
  metadata: z.boolean().default(true),
});

const ColumnSchema = z.object({
  studentCode: z.boolean().default(true),
  banglarShikshaId: z.boolean().default(true),
  nameEnglish: z.boolean().default(true),
  nameBengali: z.boolean().default(true),
  gender: z.boolean().default(false),
  dailyGrid: z.boolean().default(true),
  totals: z.boolean().default(true),
});

const LocalizedTextSchema = z.object({
  en: z.string().min(1).max(1000),
  bn: z.string().min(1).max(1000),
  hi: z.string().min(1).max(1000),
});

export const ReportingProfileConfigurationSchema = z.object({
  layout: z.enum(['PORTRAIT', 'LANDSCAPE'] as const).default('LANDSCAPE'),
  language: z.enum(['ENGLISH', 'BENGALI', 'HINDI', 'BILINGUAL'] as const).default('BILINGUAL'),
  includeSheets: IncludeSheetsSchema.default({}),
  columns: ColumnSchema.default({}),
  signatureBlocks: z.array(z.string().min(1).max(100)).min(1).max(5).default([
    'Class Teacher',
    'Report Verification In-Charge',
    'Headmaster / Teacher-in-Charge',
  ]),
  disclaimer: LocalizedTextSchema,
});

export type ReportingProfileConfiguration = z.infer<typeof ReportingProfileConfigurationSchema>;

export interface ReportingProfileSnapshot {
  id: string;
  profileName: string;
  version: string;
  isDefault: boolean;
  schoolId: string | null;
  configuration: ReportingProfileConfiguration;
}

const FALLBACK_PROFILE_ID = '00000000-0000-4000-8000-000000000070';

export const FALLBACK_REPORTING_PROFILE: ReportingProfileSnapshot = {
  id: FALLBACK_PROFILE_ID,
  profileName: 'West Bengal School Management Register',
  version: '2.0.0',
  isDefault: true,
  schoolId: null,
  configuration: ReportingProfileConfigurationSchema.parse({
    layout: 'LANDSCAPE',
    language: 'BILINGUAL',
    includeSheets: {},
    columns: {},
    signatureBlocks: [
      'Class Teacher',
      'Report Verification In-Charge',
      'Headmaster / Teacher-in-Charge',
    ],
    disclaimer: {
      en: 'Institutional attendance report generated for school management records. This is not official certification and does not prove submission to any government portal.',
      bn: 'বিদ্যালয়ের ব্যবস্থাপনা রেকর্ডের জন্য তৈরি হাজিরা রিপোর্ট। এটি সরকারি সার্টিফিকেশন নয় এবং কোনো সরকারি পোর্টালে জমা দেওয়ার প্রমাণ নয়।',
      hi: 'विद्यालय प्रबंधन रिकॉर्ड के लिए तैयार उपस्थिति रिपोर्ट। यह सरकारी प्रमाणन नहीं है और किसी सरकारी पोर्टल पर जमा करने का प्रमाण नहीं है।',
    },
  }),
};

function toSnapshot(row: typeof reportingProfiles.$inferSelect): ReportingProfileSnapshot {
  return {
    id: row.id,
    profileName: row.profileName,
    version: row.version,
    isDefault: row.isDefault,
    schoolId: row.schoolId,
    configuration: ReportingProfileConfigurationSchema.parse(row.configuration),
  };
}

export async function resolveReportingProfile(
  schoolId: string,
  requestedProfileId?: string
): Promise<ReportingProfileSnapshot> {
  if (requestedProfileId) {
    const [profile] = await db
      .select()
      .from(reportingProfiles)
      .where(
        and(
          eq(reportingProfiles.id, requestedProfileId),
          or(eq(reportingProfiles.schoolId, schoolId), isNull(reportingProfiles.schoolId))
        )
      )
      .limit(1);
    if (!profile) throw new Error('REPORT_PROFILE_NOT_FOUND_OR_FORBIDDEN');
    return toSnapshot(profile);
  }

  const [schoolDefault] = await db
    .select()
    .from(reportingProfiles)
    .where(and(eq(reportingProfiles.schoolId, schoolId), eq(reportingProfiles.isDefault, true)))
    .orderBy(desc(reportingProfiles.updatedAt))
    .limit(1);
  if (schoolDefault) return toSnapshot(schoolDefault);

  const [globalDefault] = await db
    .select()
    .from(reportingProfiles)
    .where(and(isNull(reportingProfiles.schoolId), eq(reportingProfiles.isDefault, true)))
    .orderBy(desc(reportingProfiles.updatedAt))
    .limit(1);
  return globalDefault ? toSnapshot(globalDefault) : FALLBACK_REPORTING_PROFILE;
}

export async function listAvailableReportingProfiles(schoolId: string): Promise<ReportingProfileSnapshot[]> {
  const rows = await db
    .select()
    .from(reportingProfiles)
    .where(or(eq(reportingProfiles.schoolId, schoolId), isNull(reportingProfiles.schoolId)))
    .orderBy(desc(reportingProfiles.isDefault), desc(reportingProfiles.updatedAt));

  if (rows.length === 0) return [FALLBACK_REPORTING_PROFILE];
  return rows.map(toSnapshot);
}
