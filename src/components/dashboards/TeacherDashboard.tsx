import React, { useState } from 'react';
import { BentoScannerGrid } from '../BentoScannerGrid';
import { StudentRosterModal } from '../StudentRosterModal';
import { Student, ClassSession } from '../../types';

export interface TeacherDashboardProps {
  students: Student[];
  onRecordAttendance?: (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  students,
  onRecordAttendance,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('Class 10-A');
  const [sessionActive, setSessionActive] = useState(true);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastScanned, setLastScanned] = useState<Student | null>(null);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.rollNumber.toString().includes(searchTerm)
  );

  const mockSession: ClassSession = {
    id: 'active-session-1',
    className: selectedClass,
    section: 'Section A',
    teacherName: 'Teacher',
    date: new Date().toISOString().slice(0, 10),
    totalStudents: students.length,
    presentCount: students.filter((s) => s.status === 'PRESENT').length,
    absentCount: students.filter((s) => s.status === 'ABSENT').length,
    status: sessionActive ? 'OPEN' : 'FINALIZED',
  };

  const handleScan = (studentId: string) => {
    const matched = students.find((s) => s.id === studentId || s.studentCode === studentId);
    if (matched) {
      setLastScanned(matched);
      if (onRecordAttendance) onRecordAttendance(matched.id, 'PRESENT');
    }
  };

  return (
    <div className="space-y-6" id="teacher-dashboard">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-emerald-500/30 text-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-400/30">
              Teacher Attendance Console
            </span>
            <h2 className="text-2xl font-black mt-2">Classroom Attendance Session</h2>
            <p className="text-emerald-200 text-xs mt-1">
              Active class session, fast optical QR scanning, and live roster verification
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSessionActive(!sessionActive)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                sessionActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
              id="toggle-session-btn"
            >
              {sessionActive ? '⏹ Close Attendance Session' : '▶ Start New Session'}
            </button>
          </div>
        </div>
      </div>

      {/* Class Quick Selection & Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Class Section:</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="Class 10-A">Class 10 - Section A (Morning)</option>
            <option value="Class 10-B">Class 10 - Section B (Morning)</option>
            <option value="Class 9-A">Class 9 - Section A (Morning)</option>
            <option value="Class 9-B">Class 9 - Section B (Morning)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search student code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 w-full sm:w-64 font-medium text-slate-800"
          />
          <button
            onClick={() => setRosterOpen(true)}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 whitespace-nowrap"
            id="view-full-roster-btn"
          >
            📋 Full Roster
          </button>
        </div>
      </div>

      {/* Live Scanner & Fast Mark Grid */}
      <BentoScannerGrid
        session={mockSession}
        students={filteredStudents}
        lastScannedStudent={lastScanned}
        language="en"
        networkStatus="ONLINE"
        pendingSyncCount={0}
        onScanStudent={handleScan}
        onSyncNow={() => {}}
        onOpenManualModal={() => setRosterOpen(true)}
        onFinalizeSession={() => setSessionActive(false)}
        scanFeedback={lastScanned ? { type: 'SUCCESS', message: `${lastScanned.name} marked PRESENT` } : null}
      />

      {/* Roster Modal */}
      {rosterOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setRosterOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold text-lg"
            >
              ✕
            </button>
            <StudentRosterModal
              students={students}
              language="en"
              onUpdateStatus={(id, status) => {
                if (onRecordAttendance) onRecordAttendance(id, status as any);
              }}
              onClose={() => setRosterOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
