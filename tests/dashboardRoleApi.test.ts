import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  getDefaultRouteForRole,
  getNavigationForRole,
} from '../src/auth/permissions';

describe('Central Role & Permissions Engine', () => {
  it('defines 5 strictly separated roles', () => {
    expect(ROLES).toEqual([
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'TEACHER',
      'REPORT_VIEWER',
      'RFID_OPERATOR',
    ]);
  });

  it('correctly maps SUPER_ADMIN with global platform capabilities', () => {
    expect(hasPermission('SUPER_ADMIN', 'platform.schools.read')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'platform.security.read')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'school.settings.manage')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'rfid.cards.enroll')).toBe(true);
  });

  it('ensures SCHOOL_ADMIN has school administration but no platform permissions', () => {
    expect(hasPermission('SCHOOL_ADMIN', 'school.users.manage')).toBe(true);
    expect(hasPermission('SCHOOL_ADMIN', 'school.academics.manage')).toBe(true);
    expect(hasPermission('SCHOOL_ADMIN', 'qr.reissue')).toBe(true);
    expect(hasPermission('SCHOOL_ADMIN', 'platform.schools.manage')).toBe(false);
    expect(hasPermission('SCHOOL_ADMIN', 'platform.security.read')).toBe(false);
  });

  it('ensures TEACHER has attendance capabilities but no credential or user management', () => {
    expect(hasPermission('TEACHER', 'attendance.sessions.create')).toBe(true);
    expect(hasPermission('TEACHER', 'attendance.sessions.finalize')).toBe(true);
    expect(hasPermission('TEACHER', 'reports.read')).toBe(true);
    expect(hasPermission('TEACHER', 'school.users.manage')).toBe(false);
    expect(hasPermission('TEACHER', 'qr.reissue')).toBe(false);
    expect(hasPermission('TEACHER', 'rfid.cards.enroll')).toBe(false);
  });

  it('ensures REPORT_VIEWER is strictly read-only', () => {
    expect(hasPermission('REPORT_VIEWER', 'reports.read')).toBe(true);
    expect(hasPermission('REPORT_VIEWER', 'reports.export')).toBe(true);
    expect(hasPermission('REPORT_VIEWER', 'attendance.sessions.create')).toBe(false);
    expect(hasPermission('REPORT_VIEWER', 'attendance.sessions.finalize')).toBe(false);
    expect(hasPermission('REPORT_VIEWER', 'school.users.manage')).toBe(false);
    expect(hasPermission('REPORT_VIEWER', 'qr.issue')).toBe(false);
    expect(hasPermission('REPORT_VIEWER', 'rfid.cards.enroll')).toBe(false);
  });

  it('ensures RFID_OPERATOR has smartcard operations but no general school administration', () => {
    expect(hasPermission('RFID_OPERATOR', 'rfid.cards.enroll')).toBe(true);
    expect(hasPermission('RFID_OPERATOR', 'rfid.readers.read')).toBe(true);
    expect(hasPermission('RFID_OPERATOR', 'rfid.cards.revoke')).toBe(true);
    expect(hasPermission('RFID_OPERATOR', 'school.users.manage')).toBe(false);
    expect(hasPermission('RFID_OPERATOR', 'school.academics.manage')).toBe(false);
    expect(hasPermission('RFID_OPERATOR', 'attendance.sessions.create')).toBe(false);
  });

  it('resolves correct default landing routes for each role', () => {
    expect(getDefaultRouteForRole('SUPER_ADMIN')).toBe('/app/super-admin');
    expect(getDefaultRouteForRole('SCHOOL_ADMIN')).toBe('/app/school-admin');
    expect(getDefaultRouteForRole('TEACHER')).toBe('/app/teacher');
    expect(getDefaultRouteForRole('REPORT_VIEWER')).toBe('/app/reports');
    expect(getDefaultRouteForRole('RFID_OPERATOR')).toBe('/app/rfid');
    expect(getDefaultRouteForRole(undefined)).toBe('/login');
  });

  it('filters navigation items based on active role permissions', () => {
    const teacherNav = getNavigationForRole('TEACHER');
    expect(teacherNav.some((n) => n.href === '/app/teacher')).toBe(true);
    expect(teacherNav.some((n) => n.href === '/app/super-admin')).toBe(false);
    expect(teacherNav.some((n) => n.href === '/app/rfid/readers')).toBe(false);

    const rfidNav = getNavigationForRole('RFID_OPERATOR');
    expect(rfidNav.some((n) => n.href === '/app/rfid')).toBe(true);
    expect(rfidNav.some((n) => n.href === '/app/school-admin/users')).toBe(false);
  });
});
