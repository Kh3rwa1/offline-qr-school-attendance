export const ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER', 'RFID_OPERATOR'] as const;
export type UserRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  'platform.schools.read', 'platform.schools.manage', 'platform.security.read', 'platform.audit.read',
  'school.settings.read', 'school.settings.manage', 'school.users.read', 'school.users.manage',
  'school.academics.read', 'school.academics.manage', 'attendance.sessions.read', 'attendance.sessions.create',
  'attendance.sessions.review', 'attendance.sessions.finalize', 'attendance.manualCorrection', 'reports.read',
  'reports.export', 'qr.issue', 'qr.reissue', 'rfid.dashboard.read', 'rfid.readers.read', 'rfid.readers.manage',
  'rfid.cards.read', 'rfid.cards.enroll', 'rfid.cards.bulkEnroll', 'rfid.cards.suspend', 'rfid.cards.revoke',
  'rfid.events.read', 'notifications.read', 'notifications.retry', 'audit.read',
  // Compatibility aliases for the existing feature components; new code uses the names above.
  'CROSS_SCHOOL_VIEW', 'CROSS_SCHOOL_MANAGE', 'SCHOOL_ADMIN_SETTINGS', 'STUDENT_MANAGE', 'TEACHER_MANAGE',
  'ATTENDANCE_TAKE', 'ATTENDANCE_OVERRIDE', 'RFID_ENROLL_CARDS', 'RFID_MANAGE_READERS', 'REPORT_VIEW_ANALYTICS', 'REPORT_EXPORT',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  SCHOOL_ADMIN: [
    'school.settings.read', 'school.settings.manage', 'school.users.read', 'school.users.manage',
    'school.academics.read', 'school.academics.manage', 'attendance.sessions.read', 'attendance.sessions.create',
    'attendance.sessions.review', 'attendance.sessions.finalize', 'attendance.manualCorrection', 'reports.read',
    'reports.export', 'qr.issue', 'qr.reissue', 'rfid.dashboard.read', 'rfid.readers.read', 'rfid.readers.manage',
    'rfid.cards.read', 'rfid.cards.enroll', 'rfid.cards.bulkEnroll', 'rfid.cards.suspend', 'rfid.cards.revoke',
    'rfid.events.read', 'notifications.read', 'notifications.retry', 'audit.read', 'SCHOOL_ADMIN_SETTINGS', 'STUDENT_MANAGE', 'TEACHER_MANAGE', 'ATTENDANCE_TAKE', 'ATTENDANCE_OVERRIDE', 'RFID_ENROLL_CARDS', 'RFID_MANAGE_READERS', 'REPORT_VIEW_ANALYTICS', 'REPORT_EXPORT',
  ],
  TEACHER: ['attendance.sessions.read', 'attendance.sessions.create', 'attendance.sessions.review', 'attendance.sessions.finalize', 'reports.read', 'ATTENDANCE_TAKE', 'ATTENDANCE_OVERRIDE', 'REPORT_VIEW_ANALYTICS'],
  REPORT_VIEWER: ['attendance.sessions.read', 'reports.read', 'reports.export', 'REPORT_VIEW_ANALYTICS', 'REPORT_EXPORT'],
  RFID_OPERATOR: ['rfid.dashboard.read', 'rfid.readers.read', 'rfid.readers.manage', 'rfid.cards.read', 'rfid.cards.enroll', 'rfid.cards.bulkEnroll', 'rfid.cards.suspend', 'rfid.cards.revoke', 'rfid.events.read', 'reports.read', 'RFID_ENROLL_CARDS', 'RFID_MANAGE_READERS'],
};

export function isUserRole(value: string | undefined): value is UserRole {
  return Boolean(value && (ROLES as readonly string[]).includes(value));
}

export function hasPermission(role: UserRole | string | undefined, permission: Permission): boolean {
  return isUserRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: UserRole | string | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function getDefaultRouteForRole(role: UserRole | string | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/app/super-admin';
    case 'SCHOOL_ADMIN': return '/app/school-admin';
    case 'TEACHER': return '/app/teacher';
    case 'REPORT_VIEWER': return '/app/reports';
    case 'RFID_OPERATOR': return '/app/rfid';
    default: return '/login';
  }
}

export interface NavigationItem {
  label: string;
  href: string;
  permissions: readonly Permission[];
}

export function getNavigationForRole(role: UserRole | string | undefined): NavigationItem[] {
  const items: NavigationItem[] = [
    { label: 'Overview', href: getDefaultRouteForRole(role), permissions: [] },
    { label: 'Schools', href: '/app/super-admin/schools', permissions: ['platform.schools.read'] },
    { label: 'Security', href: '/app/super-admin/security', permissions: ['platform.security.read'] },
    { label: 'Audit', href: '/app/super-admin/audit', permissions: ['platform.audit.read'] },
    { label: 'Users', href: '/app/school-admin/users', permissions: ['school.users.read'] },
    { label: 'Academics', href: '/app/school-admin/academics', permissions: ['school.academics.read'] },
    { label: 'Attendance operations', href: '/app/school-admin/attendance', permissions: ['attendance.sessions.read'] },
    { label: 'Notifications', href: '/app/school-admin/notifications', permissions: ['notifications.read'] },
    { label: 'Classes', href: '/app/teacher/classes', permissions: ['attendance.sessions.read'] },
    { label: 'Offline workspace', href: '/app/teacher/offline', permissions: ['attendance.sessions.create'] },
    { label: 'Daily reports', href: '/app/reports/daily', permissions: ['reports.read'] },
    { label: 'Trends', href: '/app/reports/trends', permissions: ['reports.read'] },
    { label: 'Exports', href: '/app/reports/exports', permissions: ['reports.export'] },
    { label: 'Readers', href: '/app/rfid/readers', permissions: ['rfid.readers.read'] },
    { label: 'Cards', href: '/app/rfid/cards', permissions: ['rfid.cards.read'] },
    { label: 'Enrollment', href: '/app/rfid/enrollment', permissions: ['rfid.cards.enroll'] },
    { label: 'RFID events', href: '/app/rfid/events', permissions: ['rfid.events.read'] },
  ];
  return items.filter((item) => item.permissions.length === 0 || hasAnyPermission(role, item.permissions));
}

// Backwards-compatible names used by the existing dashboard components.
export const getDefaultDashboardRoute = getDefaultRouteForRole;
