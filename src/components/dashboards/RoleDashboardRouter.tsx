import React, { useState } from 'react';
import { UserRole } from '../../auth/permissions';
import { DashboardLayout } from '../layout/DashboardLayout';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { SchoolAdminDashboard } from './SchoolAdminDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { RfidOperatorDashboard } from './RfidOperatorDashboard';
import { ReportViewerDashboard } from './ReportViewerDashboard';
import { Student, Language } from '../../types';

export interface RoleDashboardRouterProps {
  userRole: UserRole | string;
  userName?: string;
  schoolName?: string;
  students: Student[];
  language?: Language;
  onLogout: () => void;
  onReissueQr?: (studentId: string) => void;
  onRevokeQr?: (studentId: string) => void;
  onRecordAttendance?: (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => void;
}

export const RoleDashboardRouter: React.FC<RoleDashboardRouterProps> = ({
  userRole,
  userName,
  schoolName,
  students,
  language = 'en',
  onLogout,
  onReissueQr = () => {},
  onRevokeQr = () => {},
  onRecordAttendance,
}) => {
  const getDefaultView = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'super-admin';
      case 'SCHOOL_ADMIN':
        return 'school-admin';
      case 'TEACHER':
        return 'teacher';
      case 'RFID_OPERATOR':
        return 'rfid-operator';
      case 'REPORT_VIEWER':
        return 'report-viewer';
      default:
        return 'teacher';
    }
  };

  const [activeView, setActiveView] = useState<string>(getDefaultView(userRole));
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  const renderActiveDashboard = () => {
    switch (activeView) {
      case 'super-admin':
        return <SuperAdminDashboard onSelectSchool={(id) => { setSelectedSchoolId(id); setActiveView('school-admin'); }} />;
      case 'school-admin':
        return (
          <SchoolAdminDashboard
            students={students}
            language={language}
            onReissueQr={onReissueQr}
            onRevokeQr={onRevokeQr}
            schoolId={selectedSchoolId}
          />
        );
      case 'teacher':
        return (
          <TeacherDashboard
            students={students}
            onRecordAttendance={onRecordAttendance}
          />
        );
      case 'rfid-operator':
        return <RfidOperatorDashboard students={students} schoolId={selectedSchoolId} />;
      case 'report-viewer':
        return <ReportViewerDashboard students={students} language={language} />;
      default:
        return (
          <TeacherDashboard
            students={students}
            onRecordAttendance={onRecordAttendance}
          />
        );
    }
  };

  return (
    <DashboardLayout
      userRole={userRole}
      userName={userName}
      schoolName={schoolName}
      activeView={activeView}
      onNavigate={setActiveView}
      onLogout={onLogout}
      selectedSchoolId={selectedSchoolId}
      onSelectSchool={setSelectedSchoolId}
    >
      {renderActiveDashboard()}
    </DashboardLayout>
  );
};
