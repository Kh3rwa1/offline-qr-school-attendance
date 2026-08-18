import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { reportingProfiles } from '../db/schema';

export const BUILT_IN_REPORT_PROFILE_ID = '00000000-0000-4000-8000-000000000070';

const localizedTextSchema = z.object({
  en: z.string().min(1).max(500),
  bn: z.string().min(1).max(500),
  hi: z.string().min(1).max(500),
});

export const reportingProfileConfigurationSchema = z.object({
  language: z.enum(['ENGLISH', 'BENGALI', 'BILINGUAL', 'HINDI'] as const).default('BILINGUAL'),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE'] as const).default('LANDSCAPE'),
  columns: z.array(z.string().min(1).max(80)).min(1).max(80),
  labels: z.object({
    en: z.record(z.string(), z.string()),
    bn: z.record(z.string(), z.string()),
    hi: z.record(z.string(), z.string()),
  }),
  signatureBlocks: z.array(z.string().min(1).max(120)).max(10),
  disclaimer: localizedTextSchema,
});

export type ReportingProfileConfiguration = z.infer<typeof reportingProfileConfigurationSchema>;

export interface ResolvedReportingProfile {
  id: string;
  schoolId: string | null;
  profileName: string;
  version: string;
  isDefault: boolean;
  configuration: ReportingProfileConfiguration;
}

function toResolvedProfile(row: any): ResolvedReportingProfile {
  return {
    id: String(row.id),
    schoolId: row.schoolId ? String(row.schoolId) : null,
    profileName: String(row.profileName),
    version: String(row.version),
    isDefault: Boolean(row.isDefault),
    configuration: reportingProfileConfigurationSchema.parse(row.configuration),
  };
}

export async function listReportingProfiles(schoolId: string): Promise<ResolvedReportingProfile[]> {
  const rows = await db
    .select()
    .from(reportingProfiles)
    .where(
      and(
        eq(reportingProfiles.isActive, true),
        or(eq(reportingProfiles.schoolId, schoolId), isNull(reportingProfiles.schoolId))
      )
    )
    .orderBy(asc(reportingProfiles.schoolId), asc(reportingProfiles.profileName));
  return rows.map(toResolvedProfile);
}

export async function resolveReportingProfile(params: {
  schoolId: string;
  profileId?: string;
}): Promise<ResolvedReportingProfile> {
  if (params.profileId) {
    const [selected] = await db
      .select()
      .from(reportingProfiles)
      .where(
        and(
          eq(reportingProfiles.id, params.profileId),
          eq(reportingProfiles.isActive, true),
          or(eq(reportingProfiles.schoolId, params.schoolId), isNull(reportingProfiles.schoolId))
        )
      )
      .limit(1);
    if (!selected) throw new Error('REPORT_PROFILE_NOT_FOUND');
    return toResolvedProfile(selected);
  }

  const [schoolDefault] = await db
    .select()
    .from(reportingProfiles)
    .where(
      and(
        eq(reportingProfiles.schoolId, params.schoolId),
        eq(reportingProfiles.isActive, true),
        eq(reportingProfiles.isDefault, true)
      )
    )
    .limit(1);
  if (schoolDefault) return toResolvedProfile(schoolDefault);

  const [builtIn] = await db
    .select()
    .from(reportingProfiles)
    .where(
      and(
        eq(reportingProfiles.id, BUILT_IN_REPORT_PROFILE_ID),
        eq(reportingProfiles.isActive, true),
        isNull(reportingProfiles.schoolId)
      )
    )
    .limit(1);
  if (!builtIn) throw new Error('REPORT_PROFILE_CONFIGURATION_MISSING');
  return toResolvedProfile(builtIn);
}
