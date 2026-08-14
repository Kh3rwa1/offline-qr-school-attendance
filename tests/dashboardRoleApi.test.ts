import { describe, it, expect, beforeAll } from 'vitest';
import { seedDatabase } from '../src/db/seed';
import { hasPermission, getDefaultDashboardRoute } from '../src/auth/permissions';
import { withTenantContext } from '../src/db/index';
import { schoolMemberships } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Role-Aware Dashboard Architecture & Permissions Tests', () => {
  let seeded: any;

  beforeAll(async () => {
    seeded = await seedDatabase();
  });

  it('1. Permissions Matrix correctly validates capabilities per role', () => {
    // Super Admin permissions
    expect(hasPermission('SUPER_ADMIN', 'CROSS_SCHOOL_VIEW')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'RFID_ENROLL_CARDS')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'REPORT_EXPORT')).toBe(true);

    // School Admin permissions
    expect(hasPermission('SCHOOL_ADMIN', 'CROSS_SCHOOL_VIEW')).toBe(false);
    expect(hasPermission('SCHOOL_ADMIN', 'SCHOOL_ADMIN_SETTINGS')).toBe(true);
    expect(hasPermission('SCHOOL_ADMIN', 'ATTENDANCE_TAKE')).toBe(true);
    expect(hasPermission('SCHOOL_ADMIN', 'STUDENT_MANAGE')).toBe(true);

    // Teacher permissions
    expect(hasPermission('TEACHER', 'ATTENDANCE_TAKE')).toBe(true);
    expect(hasPermission('TEACHER', 'ATTENDANCE_OVERRIDE')).toBe(true);
    expect(hasPermission('TEACHER', 'SCHOOL_ADMIN_SETTINGS')).toBe(false);
    expect(hasPermission('TEACHER', 'RFID_ENROLL_CARDS')).toBe(false);

    // RFID Operator permissions
    expect(hasPermission('RFID_OPERATOR', 'RFID_ENROLL_CARDS')).toBe(true);
    expect(hasPermission('RFID_OPERATOR', 'RFID_MANAGE_READERS')).toBe(true);
    expect(hasPermission('RFID_OPERATOR', 'SCHOOL_ADMIN_SETTINGS')).toBe(false);

    // Report Viewer permissions
    expect(hasPermission('REPORT_VIEWER', 'REPORT_VIEW_ANALYTICS')).toBe(true);
    expect(hasPermission('REPORT_VIEWER', 'REPORT_EXPORT')).toBe(true);
    expect(hasPermission('REPORT_VIEWER', 'ATTENDANCE_TAKE')).toBe(false);
    expect(hasPermission('REPORT_VIEWER', 'RFID_ENROLL_CARDS')).toBe(false);
  });

  it('2. Default dashboard routes correctly map to role landing pages', () => {
    expect(getDefaultDashboardRoute('SUPER_ADMIN')).toBe('/app/super-admin');
    expect(getDefaultDashboardRoute('SCHOOL_ADMIN')).toBe('/app/school-admin');
    expect(getDefaultDashboardRoute('TEACHER')).toBe('/app/teacher');
    expect(getDefaultDashboardRoute('RFID_OPERATOR')).toBe('/app/rfid');
    expect(getDefaultDashboardRoute('REPORT_VIEWER')).toBe('/app/reports');
  });

  it('3. School memberships store and isolate roles under tenant boundary', async () => {
    const roles = await withTenantContext(seeded.schoolA.id, async (tx) => {
      const mems = await tx.select().from(schoolMemberships).where(eq(schoolMemberships.schoolId, seeded.schoolA.id));
      return mems.map((m: { role: string }) => m.role);
    });

    expect(roles).toContain('SCHOOL_ADMIN');
    expect(roles).toContain('TEACHER');
  });
});
