import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { LogIn } from 'lucide-react';
import { getDefaultRouteForRole } from '../auth/permissions';

export const LoginPage: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('+919100000002');
  const [password, setPassword] = useState('TeacherPassword123!');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, activeRole } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(phoneNumber, password);
      const from = (location.state as any)?.from?.pathname || getDefaultRouteForRole(activeRole || undefined);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 grid place-items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md space-y-6 border border-slate-200">
        <header className="space-y-1 text-center">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-md mb-3">
            🎓
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Offline QR Attendance</h1>
          <p className="text-xs text-slate-500 font-medium">Enterprise Role-Aware Authentication</p>
        </header>

        {error && (
          <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Phone number
            <input
              aria-label="Phone number"
              required
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +919100000002"
              className="w-full mt-1 border border-slate-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              id="phone-number-input"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Password
            <input
              aria-label="Password"
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full mt-1 border border-slate-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              id="password-input"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 font-bold text-xs flex gap-2 justify-center items-center shadow-md transition-colors"
            id="sign-in-btn"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-400 font-medium">Quick switch demo accounts:</p>
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => {
                setPhoneNumber('+919100000001');
                setPassword('SchoolAdminPassword123!');
              }}
              className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg"
            >
              School Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setPhoneNumber('+919100000002');
                setPassword('TeacherPassword123!');
              }}
              className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg"
            >
              Teacher
            </button>
            <button
              type="button"
              onClick={() => {
                setPhoneNumber('+919100000003');
                setPassword('RfidOpPassword123!');
              }}
              className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg"
            >
              RFID Op
            </button>
            <button
              type="button"
              onClick={() => {
                setPhoneNumber('+919100000004');
                setPassword('ReportViewerPassword123!');
              }}
              className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg"
            >
              Viewer
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
