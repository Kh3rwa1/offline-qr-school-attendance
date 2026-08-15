import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from '../auth/RequireAuth';
import RequireRole from '../auth/RequireRole';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from './LoginPage';
import LandingPage from './LandingPage';
import UnauthorizedPage from '../auth/UnauthorizedPage';
import { useSession } from './SessionProvider';
import { getDefaultRouteForRole } from '../auth/permissions';

import SuperAdminDashboard from '../dashboards/super-admin/SuperAdminDashboard';
import SchoolAdminDashboard from '../dashboards/school-admin/SchoolAdminDashboard';
import TeacherDashboard from '../dashboards/teacher/TeacherDashboard';
import ReportViewerDashboard from '../dashboards/report-viewer/ReportViewerDashboard';
import RfidOperatorDashboard from '../dashboards/rfid-operator/RfidOperatorDashboard';

// Lazy load secondary subpages for code splitting
const SchoolsOverview = lazy(() => import('../dashboards/super-admin/SchoolsOverview'));
const SecurityOverview = lazy(() => import('../dashboards/super-admin/SecurityOverview'));
const AuditOverview = lazy(() => import('../dashboards/super-admin/AuditOverview'));

const UserManagement = lazy(() => import('../dashboards/school-admin/UserManagement'));
const StudentRoster = lazy(() => import('../dashboards/school-admin/StudentRoster'));
const AcademicManagement = lazy(() => import('../dashboards/school-admin/AcademicManagement'));
const AttendanceOperations = lazy(() => import('../dashboards/school-admin/AttendanceOperations'));
const NotificationOperations = lazy(() => import('../dashboards/school-admin/NotificationOperations'));

const AssignedClasses = lazy(() => import('../dashboards/teacher/AssignedClasses'));
const OfflineWorkspace = lazy(() => import('../dashboards/teacher/OfflineWorkspace'));

const DailyReports = lazy(() => import('../dashboards/report-viewer/DailyReports'));
const TrendReports = lazy(() => import('../dashboards/report-viewer/TrendReports'));
const ExportCenter = lazy(() => import('../dashboards/report-viewer/ExportCenter'));

const ReaderOperations = lazy(() => import('../dashboards/rfid-operator/ReaderOperations'));
const CardOperations = lazy(() => import('../dashboards/rfid-operator/CardOperations'));
const EnrollmentOperations = lazy(() => import('../dashboards/rfid-operator/EnrollmentOperations'));
const RfidIncidentQueue = lazy(() => import('../dashboards/rfid-operator/RfidIncidentQueue'));

const HomeOrLanding: React.FC = () => {
  const { isAuthenticated, activeRole, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas text-ink font-bold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-forest-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-display">Verifying secure workspace session…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getDefaultRouteForRole(activeRole || undefined)} replace />;
  }

  return <LandingPage />;
};

const RootRedirect: React.FC = () => {
  const { isAuthenticated, activeRole, isLoading } = useSession();
  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas text-ink font-bold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-forest-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-display">Verifying secure session…</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultRouteForRole(activeRole || undefined)} replace />;
};

export const AppRouter: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-canvas text-ink font-bold text-xs">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-forest-700 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-display">Loading workspace…</span>
          </div>
        </div>
      }
    >
      <Routes>
        {/* Public Acquisition Landing Page */}
        <Route path="/" element={<HomeOrLanding />} />
        <Route path="/welcome" element={<LandingPage />} />

        {/* Global and Path-Based Login Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/s/:schoolSlug/login" element={<LoginPage />} />

        {/* Protected Dashboard Shell */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<RootRedirect />} />

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
            path="school-admin/students"
            element={
              <RequireRole allowedRoles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <StudentRoster />
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
              <RequireRole allowedRoles={['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <ReportViewerDashboard />
              </RequireRole>
            }
          />
          <Route
            path="reports/daily"
            element={
              <RequireRole allowedRoles={['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
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

          {/* RFID Operator Route Aliases */}
          <Route
            path="rfid-operator"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <RfidOperatorDashboard />
              </RequireRole>
            }
          />
          <Route
            path="rfid-operator/readers"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <ReaderOperations />
              </RequireRole>
            }
          />
          <Route
            path="rfid-operator/cards"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <CardOperations />
              </RequireRole>
            }
          />
          <Route
            path="rfid-operator/enrollment"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <EnrollmentOperations />
              </RequireRole>
            }
          />
          <Route
            path="rfid-operator/events"
            element={
              <RequireRole allowedRoles={['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}>
                <RfidIncidentQueue />
              </RequireRole>
            }
          />

          {/* 403 Page */}
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>

        {/* Path-based School Tenant Route Aliases */}
        <Route path="/s/:schoolSlug" element={<Navigate to="login" replace />} />
        <Route path="/s/:schoolSlug/app/*" element={<Navigate to="/app" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
