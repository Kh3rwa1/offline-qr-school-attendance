import { z } from 'zod';

// 1. Super Admin Dashboard Schema
export const SuperAdminSummarySchema = z.object({
  systemHealth: z.enum(['OPERATIONAL', 'DEGRADED', 'OUTAGE']),
  totalSchools: z.number().int().nonnegative(),
  totalStudents: z.number().int().nonnegative(),
  totalTeachers: z.number().int().nonnegative(),
  totalAttendanceSessions: z.number().int().nonnegative(),
  schools: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string().optional().nullable(),
      udiseCode: z.string().optional().nullable(),
      district: z.string().optional().nullable(),
      status: z.string().optional().nullable(),
      createdAt: z.string().optional().nullable(),
    })
  ).optional().default([]),
});

export type SuperAdminSummary = z.infer<typeof SuperAdminSummarySchema>;

// 2. School Admin Dashboard Schema
export const SchoolAdminSummarySchema = z.object({
  totalStudents: z.number().int().nonnegative(),
  totalTeachers: z.number().int().nonnegative(),
  totalClasses: z.number().int().nonnegative(),
  totalReaders: z.number().int().nonnegative(),
  todayAttendancePercentage: z.number().min(0).max(100),
  pendingSmsNotifications: z.number().int().nonnegative(),
});

export type SchoolAdminSummary = z.infer<typeof SchoolAdminSummarySchema>;

// 3. Teacher Dashboard Schema
export const TeacherSummarySchema = z.object({
  assignedClassesCount: z.number().int().nonnegative(),
  activeSessionOpen: z.boolean(),
  offlineSynced: z.boolean(),
});

export type TeacherSummary = z.infer<typeof TeacherSummarySchema>;

// 4. Report Viewer Dashboard Schema
export const ReportViewerSummarySchema = z.object({
  overallAttendanceRate: z.number().min(0).max(100),
  totalSessionsRecorded: z.number().int().nonnegative(),
  flaggedAbsenceCount: z.number().int().nonnegative(),
  lastReportGeneratedAt: z.string(),
});

export type ReportViewerSummary = z.infer<typeof ReportViewerSummarySchema>;

// 5. RFID Operator Dashboard Schema
export const RfidOperatorSummarySchema = z.object({
  activeReadersCount: z.number().int().nonnegative(),
  totalCardsEnrolled: z.number().int().nonnegative(),
  gatewayQueueDepth: z.number().int().nonnegative(),
  recentScanRejections: z.number().int().nonnegative(),
});

export type RfidOperatorSummary = z.infer<typeof RfidOperatorSummarySchema>;

// Generic API Envelope
export const DashboardResponseEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    schoolId: z.string().uuid().optional(),
    generatedAt: z.string(),
    data: dataSchema,
  });
