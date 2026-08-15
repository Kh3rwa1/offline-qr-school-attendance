import React, { useState } from 'react';
import { Student, Language } from '../types';
import { Search, QrCode, Printer, UserCheck, UserX, Clock, X } from 'lucide-react';
import { Button } from './shared/Button';

interface StudentRosterModalProps {
  students: Student[];
  language: Language;
  onUpdateStatus: (studentId: string, status: Student['status']) => void;
  onClose?: () => void;
}

export const StudentRosterModal: React.FC<StudentRosterModalProps> = ({
  students,
  language,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentForQr, setSelectedStudentForQr] = useState<Student | null>(null);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nameBn.includes(searchTerm) ||
      s.rollNumber.toString().includes(searchTerm) ||
      s.studentCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-card p-6 flex-1 flex flex-col gap-4 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">
            {language === 'bn' ? 'ছাত্র-ছাত্রী রেজিস্টার ও QR কার্ড' : 'Student Roster & QR Cards'}
          </h2>
          <p className="t-body text-xs text-ink-soft">
            {language === 'bn'
              ? 'অষ্টম শ্রেণী-ক | মোট ৫২ জন ছাত্র-ছাত্রী'
              : 'Class VIII-A | Total 52 Authorized Roster Records'}
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'bn' ? 'নাম বা রোল নং দিয়ে খুঁজুন...' : 'Search by name or roll...'}
            className="w-full bg-surface-soft text-ink text-xs px-3 py-2 pl-8 rounded-full border border-line focus:bg-surface focus:border-forest-700 outline-none"
          />
          <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto rounded-2xl border border-line max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-soft text-ink-muted font-bold uppercase tracking-wider sticky top-0 z-10 font-display">
            <tr>
              <th className="p-3">Roll</th>
              <th className="p-3">Student Name / নাম</th>
              <th className="p-3">Banglar Shiksha ID</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-medium text-ink bg-surface">
            {filtered.map((student) => (
              <tr key={student.id} className="table-row-hover">
                <td className="p-3 font-mono font-bold text-ink">
                  #{String(student.rollNumber).padStart(2, '0')}
                </td>
                <td className="p-3">
                  <div className="font-bold text-ink font-display">{student.name}</div>
                  <div className="text-[11px] text-ink-soft">{student.nameBn}</div>
                </td>
                <td className="p-3 font-mono text-ink-muted">{student.banglarShikshaId || '-'}</td>
                <td className="p-3">
                  {student.status === 'PRESENT' && (
                    <span className="bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-bold px-2.5 py-1 rounded-full text-[11px] font-display">
                      PRESENT ({student.scannedAt || 'Scanned'})
                    </span>
                  )}
                  {student.status === 'ABSENT' && (
                    <span className="bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30 font-bold px-2.5 py-1 rounded-full text-[11px] font-display">
                      ABSENT
                    </span>
                  )}
                  {student.status === 'UNMARKED' && (
                    <span className="bg-surface-soft text-ink-soft border border-line font-bold px-2.5 py-1 rounded-full text-[11px] font-display">
                      UNMARKED
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => onUpdateStatus(student.id, 'PRESENT')}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        student.status === 'PRESENT'
                          ? 'bg-forest-700 text-white border-forest-700'
                          : 'bg-surface text-ink-soft hover:bg-surface-soft border-line'
                      }`}
                      title="Mark Present"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(student.id, 'LATE')}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        student.status === 'LATE'
                          ? 'bg-warning-800 text-white border-warning-800'
                          : 'bg-surface text-ink-soft hover:bg-surface-soft border-line'
                      }`}
                      title="Mark Late"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(student.id, 'ABSENT')}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        student.status === 'ABSENT'
                          ? 'bg-danger-800 text-white border-danger-800'
                          : 'bg-surface text-ink-soft hover:bg-surface-soft border-line'
                      }`}
                      title="Mark Absent"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedStudentForQr(student)}
                      className="p-1.5 bg-surface-soft hover:bg-forest-700 hover:text-white rounded-xl text-ink-soft border border-line transition-colors cursor-pointer"
                      title="View & Print QR Card"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Printable QR Preview Modal */}
      {selectedStudentForQr && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="app-card p-6 max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center">
            <button
              onClick={() => setSelectedStudentForQr(null)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="t-label text-forest-700 dark:text-forest-600 mb-1">
              West Bengal Gov. School QR ID Card
            </div>
            <h3 className="text-xl font-extrabold text-ink font-display">{selectedStudentForQr.name}</h3>
            <p className="text-sm text-ink-soft font-medium mb-4">{selectedStudentForQr.nameBn}</p>

            {/* Generated QR Card Graphic */}
            <div className="p-4 bg-surface-soft border-2 border-dashed border-line rounded-2xl flex flex-col items-center w-full">
              <div className="w-36 h-36 bg-white p-2 border border-line rounded-xl flex items-center justify-center shadow-xs relative">
                <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100">
                  <path
                    fill="currentColor"
                    d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z"
                  />
                  <path
                    fill="currentColor"
                    d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z"
                  />
                  <path
                    fill="currentColor"
                    d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z"
                  />
                  <rect x="50" y="50" width="10" height="10" fill="currentColor" />
                  <rect x="70" y="50" width="10" height="10" fill="currentColor" />
                  <rect x="50" y="70" width="10" height="10" fill="currentColor" />
                  <rect x="80" y="80" width="10" height="10" fill="currentColor" />
                  <rect x="60" y="80" width="10" height="10" fill="currentColor" />
                </svg>
              </div>
              <div className="mt-3 font-mono text-xs text-ink font-bold">
                ROLL: #{String(selectedStudentForQr.rollNumber).padStart(4, '0')} | CLASS VIII-A
              </div>
              <div className="text-[11px] text-ink-muted mt-1 font-mono">
                DIGEST: {selectedStudentForQr.qrDigest.slice(0, 16)}...
              </div>
            </div>

            <div className="mt-5 w-full">
              <Button
                variant="primary"
                size="md"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
                className="w-full justify-center"
              >
                Print Student QR Card
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentRosterModal;
