import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from '../auth/RequireAuth';
import RequireRole from '../auth/RequireRole';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from './LoginPage';
import AuthenticatedApp from './AuthenticatedApp';
import UnauthorizedPage from '../auth/UnauthorizedPage';

// Lazy load dashboard pages for code splitting & optimal bundles
const SuperAdminDashboard = lazy(() => import('../dashboards/super-admin/SuperAdminDashboard'));
const SchoolsOverview = lazy(() => import('../dashboards/super-admin/SchoolsOverview'));
const SecurityOverview = lazy(() => import('../dashboards/super-admin/SecurityOverview'));
const AuditOverview = lazy(() => import('../dashboards/super-admin/AuditOverview'));

const SchoolAdminDashboard = lazy(() => import('../dashboards/school-admin/SchoolAdminDashboard'));
const UserManagement = lazy(() => import('../dashboards/school-admin/UserManagement'));
const AcademicManagement = lazy(() => import('../dashboards/school-admin/AcademicManagement'));
const AttendanceOperations = lazy(() => import('../dashboards/school-admin/AttendanceOperations'));
const NotificationOperations = lazy(() => import('../dashboards/school-admin/NotificationOperations'));

const TeacherDashboard = lazy(() => import('../dashboards/teacher/TeacherDashboard'));
const AssignedClasses = lazy(() => import('../dashboards/teacher/AssignedClasses'));
const OfflineWorkspace = lazy(() => import('../dashboards/teacher/OfflineWorkspace'));

const ReportViewerDashboard = lazy(() => import('../dashboards/report-viewer/ReportViewerDashboard'));
const DailyReports = lazy(() => import('../dashboards/report-viewer/DailyReports'));
const TrendReports = lazy(() => import('../dashboards/report-viewer/TrendReports'));
const ExportCenter = lazy(() => import('../dashboards/report-viewer/ExportCenter'));

const RfidOperatorDashboard = lazy(() => import('../dashboards/rfid-operator/RfidOperatorDashboard'));
const ReaderOperations = lazy(() => import('../dashboards/rfid-operator/ReaderOperations'));
const CardOperations = lazy(() => import('../dashboards/rfid-operator/CardOperations'));
const EnrollmentOperations = lazy(() => import('../dashboards/rfid-operator/EnrollmentOperations'));
const RfidIncidentQueue = lazy(() => import('../dashboards/rfid-operator/RfidIncidentQueue'));

export const AppRouter: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-500 font-bold text-xs">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading workspace…</span>
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Dashboard Shell */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AuthenticatedApp />} />

          {/* Super Admin Routes */}
          <Route
            path="super-admin"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="super-admin/schools"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN']}>
                <SchoolsOverview />
              </RequireRole>
            }
          />
          <Route
            path="super-admin/security"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN']}>
                <SecurityOverview />
              </RequireRole>
            }
          />
          <Route
            path="super-admin/audit"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN']}>
                <AuditOverview />
              </RequireRole>
            }
          />

          {/* School Admin Routes */}
          <Route
            path="school-admin"
            element={
              <RequireRole allowedRoles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <SchoolAdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="school-admin/users"
            element={
              <RequireRole allowedRoles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <UserManagement />
              </RequireRole>
            }
          />
          <Route
            path="school-admin/academics"
            element={
              <RequireRole allowedRoles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <AcademicManagement />
              </RequireRole>
            }
          />
          <Route
            path="school-admin/attendance"
            element={
              <RequireRole allowedRoles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <AttendanceOperations />
              </RequireRole>
            }
          />
          <Route
            path="school-admin/notifications"
            element={
              <RequireRole allowedRoles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <NotificationOperations />
              </RequireRole>
            }
          />

          {/* Teacher Routes */}
          <Route
            path="teacher"
            element={
              <RequireRole allowedRoles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <TeacherDashboard />
              </RequireRole>
            }
          />
          <Route
            path="teacher/classes"
            element={
              <RequireRole allowedRoles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <AssignedClasses />
              </RequireRole>
            }
          />
          <Route
            path="teacher/offline"
            element={
              <RequireRole allowedRoles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <OfflineWorkspace />
              </RequireRole>
            }
          />

          {/* Report Viewer / Analytics Routes */}
          <Route
            path="reports"
            element={
              <RequireRole allowedRoles={['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']}>
                <ReportViewerDashboard />
              </RequireRole>
            }
          />
          <Route
            path="reports/daily"
            element={
              <RequireRole allowedRoles={['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']}>
                <DailyReports />
              </RequireRole>
            }
          />
          <Route
            path="reports/trends"
            element={
              <RequireRole allowedRoles={['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <TrendReports />
              </RequireRole>
            }
          />
          <Route
            path="reports/exports"
            element={
              <RequireRole allowedRoles={['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <ExportCenter />
              </RequireRole>
            }
          />

          {/* RFID Operator Routes */}
          <Route
            path="rfid"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <RfidOperatorDashboard />
              </RequireRole>
            }
          />
          <Route
            path="rfid/readers"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <ReaderOperations />
              </RequireRole>
            }
          />
          <Route
            path="rfid/cards"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <CardOperations />
              </RequireRole>
            }
          />
          <Route
            path="rfid/enrollment"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <EnrollmentOperations />
              </RequireRole>
            }
          />
          <Route
            path="rfid/events"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <RfidIncidentQueue />
              </RequireRole>
            }
          />

          {/* 403 Page */}
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>

        {/* Root Fallback */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
