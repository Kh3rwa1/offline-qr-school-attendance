import React, { useState, useEffect, useCallback } from 'react';
import { RoleDashboardRouter } from './components/dashboards/RoleDashboardRouter';
import { api } from './services/api';
import { Student } from './types';
import { clearSchoolScopedOfflineData } from './services/offlineSyncService';

type User = { id: string; fullName: string; phoneNumber: string; email?: string };
type Membership = { schoolId: string; schoolName: string; role: string; status: string };
type AuthState = { user: User; memberships: Membership[]; schoolId: string; role: string };

const MOCK_STUDENTS: Student[] = [
  {
    id: 's-001',
    studentCode: 'MMPS-2026-001',
    name: 'Aarav Sharma',
    nameBn: 'আরভ শর্মা',
    className: 'Class 10',
    section: 'Section A',
    rollNumber: 1,
    qrDigest: 'digest-001',
    status: 'UNMARKED',
  },
  {
    id: 's-002',
    studentCode: 'MMPS-2026-002',
    name: 'Priya Mukherjee',
    nameBn: 'প্রিয়া মুখার্জী',
    className: 'Class 10',
    section: 'Section A',
    rollNumber: 2,
    qrDigest: 'digest-002',
    status: 'UNMARKED',
  },
  {
    id: 's-003',
    studentCode: 'MMPS-2026-003',
    name: 'Debjit Das',
    nameBn: 'দেবজিৎ দাস',
    className: 'Class 10',
    section: 'Section A',
    rollNumber: 3,
    qrDigest: 'digest-003',
    status: 'UNMARKED',
  },
  {
    id: 's-004',
    studentCode: 'MMPS-2026-004',
    name: 'Ananya Roy',
    nameBn: 'অনন্যা রায়',
    className: 'Class 10',
    section: 'Section B',
    rollNumber: 1,
    qrDigest: 'digest-004',
    status: 'UNMARKED',
  },
];

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);

  const restoreSession = useCallback(async () => {
    try {
      const stored = localStorage.getItem('attendance.auth');
      if (stored) {
        setAuth(JSON.parse(stored));
        return;
      }
      const res = await api<{ success: boolean; data: any }>('/api/v1/auth/me');
      if (res.success && res.data?.user) {
        const primaryMembership = res.data.memberships?.[0] || {
          schoolId: res.data.user.schoolId || 'primary-school',
          schoolName: 'Murshidabad Model Primary School',
          role: res.data.user.role || 'TEACHER',
        };
        const nextAuth: AuthState = {
          user: res.data.user,
          memberships: res.data.memberships || [primaryMembership],
          schoolId: primaryMembership.schoolId,
          role: primaryMembership.role,
        };
        setAuth(nextAuth);
        localStorage.setItem('attendance.auth', JSON.stringify(nextAuth));
      }
    } catch {
      // Unauthenticated
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setError('');
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: loginForm.identifier,
          password: loginForm.password,
        }),
      });

      if (res.success && res.data?.user) {
        const primaryMembership = res.data.memberships?.[0] || {
          schoolId: res.data.user.schoolId || 'primary-school',
          schoolName: 'Murshidabad Model Primary School',
          role: res.data.user.role || 'SCHOOL_ADMIN',
        };
        const nextAuth: AuthState = {
          user: res.data.user,
          memberships: res.data.memberships || [primaryMembership],
          schoolId: primaryMembership.schoolId,
          role: primaryMembership.role,
        };
        setAuth(nextAuth);
        localStorage.setItem('attendance.auth', JSON.stringify(nextAuth));
      } else {
        throw new Error('Invalid login response');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    if (auth) {
      await clearSchoolScopedOfflineData(auth.schoolId);
      await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
    localStorage.removeItem('attendance.auth');
    localStorage.removeItem('attendance.loggedOut');
    setAuth(null);
  }

  // If unauthenticated, show enterprise login screen
  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg mb-4 text-white font-black">
              🎓
            </div>
            <h1 className="text-2xl font-black text-slate-900">AttendEase OS</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Enterprise Multi-Tenant School Attendance System
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium" id="login-error-msg">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number or Identifier
              </label>
              <input
                type="text"
                required
                value={loginForm.identifier}
                onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                placeholder="+919876543210 or admin@school.edu"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                id="login-identifier-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                id="login-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors disabled:opacity-50"
              id="login-submit-btn"
            >
              {loginBusy ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </form>

          {/* Demo Role Fast Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
              Fast Demo Role Sign-In
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const demoAuth: AuthState = {
                    user: { id: 'usr-sa', fullName: 'Platform Director', phoneNumber: '+919999999999' },
                    memberships: [{ schoolId: 'platform', schoolName: 'Global Platform', role: 'SUPER_ADMIN', status: 'ACTIVE' }],
                    schoolId: 'platform',
                    role: 'SUPER_ADMIN',
                  };
                  setAuth(demoAuth);
                  localStorage.setItem('attendance.auth', JSON.stringify(demoAuth));
                }}
                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg border border-purple-200 font-bold text-left transition-colors"
                id="demo-super-admin-btn"
              >
                🏢 Super Admin
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoAuth: AuthState = {
                    user: { id: 'usr-hm', fullName: 'Dr. Ramesh Sen', phoneNumber: '+919876543210' },
                    memberships: [{ schoolId: 'school-1', schoolName: 'Murshidabad Model Primary School', role: 'SCHOOL_ADMIN', status: 'ACTIVE' }],
                    schoolId: 'school-1',
                    role: 'SCHOOL_ADMIN',
                  };
                  setAuth(demoAuth);
                  localStorage.setItem('attendance.auth', JSON.stringify(demoAuth));
                }}
                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-200 font-bold text-left transition-colors"
                id="demo-school-admin-btn"
              >
                🏫 School Admin
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoAuth: AuthState = {
                    user: { id: 'usr-tc', fullName: 'Sunita Banerjee', phoneNumber: '+919876543211' },
                    memberships: [{ schoolId: 'school-1', schoolName: 'Murshidabad Model Primary School', role: 'TEACHER', status: 'ACTIVE' }],
                    schoolId: 'school-1',
                    role: 'TEACHER',
                  };
                  setAuth(demoAuth);
                  localStorage.setItem('attendance.auth', JSON.stringify(demoAuth));
                }}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 font-bold text-left transition-colors"
                id="demo-teacher-btn"
              >
                📝 Teacher
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoAuth: AuthState = {
                    user: { id: 'usr-rfid', fullName: 'Hardware Operator', phoneNumber: '+919876543212' },
                    memberships: [{ schoolId: 'school-1', schoolName: 'Murshidabad Model Primary School', role: 'RFID_OPERATOR', status: 'ACTIVE' }],
                    schoolId: 'school-1',
                    role: 'RFID_OPERATOR',
                  };
                  setAuth(demoAuth);
                  localStorage.setItem('attendance.auth', JSON.stringify(demoAuth));
                }}
                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 font-bold text-left transition-colors"
                id="demo-rfid-btn"
              >
                💳 RFID Operator
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoAuth: AuthState = {
                    user: { id: 'usr-rv', fullName: 'District Inspector', phoneNumber: '+919876543213' },
                    memberships: [{ schoolId: 'school-1', schoolName: 'Murshidabad Model Primary School', role: 'REPORT_VIEWER', status: 'ACTIVE' }],
                    schoolId: 'school-1',
                    role: 'REPORT_VIEWER',
                  };
                  setAuth(demoAuth);
                  localStorage.setItem('attendance.auth', JSON.stringify(demoAuth));
                }}
                className="p-2 col-span-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg border border-cyan-200 font-bold text-left transition-colors"
                id="demo-report-viewer-btn"
              >
                📈 Report Viewer / Auditor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: Render unified RoleDashboardRouter
  return (
    <RoleDashboardRouter
      userRole={auth.role}
      userName={auth.user.fullName || auth.user.email}
      schoolName={auth.memberships[0]?.schoolName}
      students={students}
      onLogout={handleLogout}
      onReissueQr={(id) => {
        setStudents((prev) =>
          prev.map((s) => (s.id === id ? { ...s, qrDigest: `reissued-${Date.now()}` } : s))
        );
      }}
      onRevokeQr={(id) => {
        setStudents((prev) =>
          prev.map((s) => (s.id === id ? { ...s, qrDigest: '', status: 'UNMARKED' } : s))
        );
      }}
    />
  );
}
