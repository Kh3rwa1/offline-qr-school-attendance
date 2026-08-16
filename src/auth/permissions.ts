export const ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'REPORT_VIEWER',
  'RFID_OPERATOR',
] as const;

export type UserRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Platform / Super Admin
  'platform.schools.read',
  'platform.schools.manage',
  'platform.security.read',
  'platform.audit.read',
  
  // School Admin & Operations
  'school.settings.read',
  'school.settings.manage',
  'school.users.read',
  'school.users.manage',
  'school.academics.read',
  'school.academics.manage',
  
  // Attendance
  'attendance.sessions.read',
  'attendance.sessions.create',
  'attendance.sessions.review',
  'attendance.sessions.finalize',
  'attendance.manualCorrection',
  
  // Reports
  'reports.read',
  'reports.export',
  
  // Credentials (QR)
  'qr.issue',
  'qr.reissue',
  
  // RFID Smartcards & Readers
  'rfid.dashboard.read',
  'rfid.readers.read',
  'rfid.readers.manage',
  'rfid.cards.read',
  'rfid.cards.enroll',
  'rfid.cards.bulkEnroll',
  'rfid.cards.suspend',
  'rfid.cards.revoke',
  'rfid.events.read',
  
  // Notifications & Auditing
  'notifications.read',
  'notifications.retry',
  'audit.read',

  // Legacy Aliases for backwards compatibility
  'CROSS_SCHOOL_VIEW',
  'CROSS_SCHOOL_MANAGE',
  'SCHOOL_ADMIN_SETTINGS',
  'STUDENT_MANAGE',
  'TEACHER_MANAGE',
  'ATTENDANCE_TAKE',
  'ATTENDANCE_OVERRIDE',
  'RFID_ENROLL_CARDS',
  'RFID_MANAGE_READERS',
  'REPORT_VIEW_ANALYTICS',
  'REPORT_EXPORT',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  SCHOOL_ADMIN: [
    'school.settings.read',
    'school.settings.manage',
    'school.users.read',
    'school.users.manage',
    'school.academics.read',
    'school.academics.manage',
    'attendance.sessions.read',
    'attendance.sessions.create',
    'attendance.sessions.review',
    'attendance.sessions.finalize',
    'attendance.manualCorrection',
    'reports.read',
    'reports.export',
    'qr.issue',
    'qr.reissue',
    'rfid.dashboard.read',
    'rfid.readers.read',
    'rfid.readers.manage',
    'rfid.cards.read',
    'rfid.cards.enroll',
    'rfid.cards.bulkEnroll',
    'rfid.cards.suspend',
    'rfid.cards.revoke',
    'rfid.events.read',
    'notifications.read',
    'notifications.retry',
    'audit.read',
    // Compatibility aliases
    'SCHOOL_ADMIN_SETTINGS',
    'STUDENT_MANAGE',
    'TEACHER_MANAGE',
    'ATTENDANCE_TAKE',
    'ATTENDANCE_OVERRIDE',
    'RFID_ENROLL_CARDS',
    'RFID_MANAGE_READERS',
    'REPORT_VIEW_ANALYTICS',
    'REPORT_EXPORT',
  ],
  TEACHER: [
    'attendance.sessions.read',
    'attendance.sessions.create',
    'attendance.sessions.review',
    'attendance.sessions.finalize',
    'reports.read',
    // Compatibility aliases
    'ATTENDANCE_TAKE',
    'ATTENDANCE_OVERRIDE',
    'REPORT_VIEW_ANALYTICS',
  ],
  REPORT_VIEWER: [
    'attendance.sessions.read',
    'reports.read',
    'reports.export',
    // Compatibility aliases
    'REPORT_VIEW_ANALYTICS',
    'REPORT_EXPORT',
  ],
  RFID_OPERATOR: [
    'rfid.dashboard.read',
    'rfid.readers.read',
    'rfid.readers.manage',
    'rfid.cards.read',
    'rfid.cards.enroll',
    'rfid.cards.bulkEnroll',
    'rfid.cards.suspend',
    'rfid.cards.revoke',
    'rfid.events.read',
    'reports.read',
    // Compatibility aliases
    'RFID_ENROLL_CARDS',
    'RFID_MANAGE_READERS',
  ],
};

export function isUserRole(value: string | undefined): value is UserRole {
  return Boolean(value && (ROLES as readonly string[]).includes(value));
}

export function hasPermission(role: UserRole | string | undefined, permission: Permission): boolean {
  if (!isUserRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: UserRole | string | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function getDefaultRouteForRole(role: UserRole | string | undefined): string {
  const isRfidEnabled =
    (typeof process !== 'undefined' && process.env?.FEATURE_RFID === 'true') ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FEATURE_RFID === 'true');

  switch (role) {
    case 'SUPER_ADMIN':
      return '/app/super-admin';
    case 'SCHOOL_ADMIN':
      return '/app/school-admin';
    case 'TEACHER':
      return '/app/teacher';
    case 'REPORT_VIEWER':
      return '/app/reports';
    case 'RFID_OPERATOR':
      return isRfidEnabled ? '/app/rfid' : '/login';
    default:
      return '/login';
  }
}

export const getDefaultDashboardRoute = getDefaultRouteForRole;

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  permissions: readonly Permission[];
}

export function getNavigationForRole(role: UserRole | string | undefined): NavigationItem[] {
  const allNavItems: NavigationItem[] = [
    // Super Admin
    {
      id: 'super-admin-overview',
      label: 'Platform Overview',
      href: '/app/super-admin',
      icon: 'platform',
      permissions: ['platform.schools.read'],
    },
    {
      id: 'super-admin-schools',
      label: 'School Directory',
      href: '/app/super-admin/schools',
      icon: 'schools',
      permissions: ['platform.schools.manage'],
    },
    {
      id: 'super-admin-security',
      label: 'Security & Health',
      href: '/app/super-admin/security',
      icon: 'security',
      permissions: ['platform.security.read'],
    },
    {
      id: 'super-admin-audit',
      label: 'Global Audit Logs',
      href: '/app/super-admin/audit',
      icon: 'audit',
      permissions: ['platform.audit.read'],
    },

    // School Admin
    {
      id: 'school-admin-overview',
      label: 'School Operations',
      href: '/app/school-admin',
      icon: 'operations',
      permissions: ['school.settings.read'],
    },
    {
      id: 'school-admin-users',
      label: 'Staff & Memberships',
      href: '/app/school-admin/users',
      icon: 'users',
      permissions: ['school.users.read'],
    },
    {
      id: 'school-admin-students',
      label: 'Student Roster',
      href: '/app/school-admin/students',
      icon: 'students',
      permissions: ['school.users.read'],
    },
    {
      id: 'school-admin-academics',
      label: 'Academic Classes',
      href: '/app/school-admin/academics',
      icon: 'academics',
      permissions: ['school.academics.read'],
    },
    {
      id: 'school-admin-attendance',
      label: 'Attendance Sessions',
      href: '/app/school-admin/attendance',
      icon: 'attendance',
      permissions: ['attendance.sessions.read'],
    },
    {
      id: 'school-admin-notifications',
      label: 'SMS Notifications',
      href: '/app/school-admin/notifications',
      icon: 'notifications',
      permissions: ['notifications.read'],
    },

    // Teacher
    {
      id: 'teacher-scanner',
      label: "Today's attendance",
      href: '/app/teacher',
      icon: 'scanner',
      permissions: ['attendance.sessions.create'],
    },
    {
      id: 'teacher-classes',
      label: 'Class list',
      href: '/app/teacher/classes',
      icon: 'classes',
      permissions: ['attendance.sessions.read'],
    },
    {
      id: 'teacher-offline',
      label: 'Phone backup',
      href: '/app/teacher/offline',
      icon: 'offline',
      permissions: ['attendance.sessions.create'],
    },

    // Report Viewer / Analytics
    {
      id: 'reports-daily',
      label: 'Daily Class Reports',
      href: '/app/reports/daily',
      icon: 'daily',
      permissions: ['reports.read'],
    },
    {
      id: 'reports-trends',
      label: 'Longitudinal Trends',
      href: '/app/reports/trends',
      icon: 'trends',
      permissions: ['reports.read'],
    },
    {
      id: 'reports-exports',
      label: 'Export Center',
      href: '/app/reports/exports',
      icon: 'exports',
      permissions: ['reports.export'],
    },

    // RFID Operator
    {
      id: 'rfid-dashboard',
      label: 'Overview',
      href: '/app/rfid',
      icon: 'station',
      permissions: ['rfid.dashboard.read'],
    },
    {
      id: 'rfid-readers',
      label: 'Gates',
      href: '/app/rfid/readers',
      icon: 'readers',
      permissions: ['rfid.readers.read'],
    },
    {
      id: 'rfid-cards',
      label: 'Student badges',
      href: '/app/rfid/cards',
      icon: 'cards',
      permissions: ['rfid.cards.read'],
    },
    {
      id: 'rfid-enrollment',
      label: 'Give badge',
      href: '/app/rfid/enrollment',
      icon: 'enrollment',
      permissions: ['rfid.cards.enroll'],
    },
    {
      id: 'rfid-events',
      label: 'Who walked in',
      href: '/app/rfid/events',
      icon: 'events',
      permissions: ['rfid.events.read'],
    },
  ];

  const isRfidEnabled =
    (typeof process !== 'undefined' && process.env?.FEATURE_RFID === 'true') ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FEATURE_RFID === 'true');

  return allNavItems
    .filter((item) => isRfidEnabled || !item.id.startsWith('rfid-'))
    .filter((item) => item.permissions.length === 0 || hasAnyPermission(role, item.permissions));
}
