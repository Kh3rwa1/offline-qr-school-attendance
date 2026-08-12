import React, { useState } from 'react';
import { Student, Language } from '../types';
import { Search, QrCode, Printer, Check, X, UserCheck, UserX, Clock } from 'lucide-react';

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
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {language === 'bn' ? 'ছাত্র-ছাত্রী রেজিস্টার ও QR কার্ড' : 'Student Roster & QR Cards'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
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
            className="w-full bg-slate-100 text-slate-800 text-xs px-3 py-2 pl-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-3">Roll</th>
              <th className="p-3">Student Name / নাম</th>
              <th className="p-3">Banglar Shiksha ID</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {filtered.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-mono font-bold text-slate-900">
                  {String(student.rollNumber).padStart(2, '0')}
                </td>
                <td className="p-3">
                  <div className="font-bold text-slate-800">{student.name}</div>
                  <div className="text-[11px] text-slate-500">{student.nameBn}</div>
                </td>
                <td className="p-3 font-mono text-slate-500">{student.banglarShikshaId || '-'}</td>
                <td className="p-3">
                  {student.status === 'PRESENT' && (
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                      PRESENT ({student.scannedAt || 'Scanned'})
                    </span>
                  )}
                  {student.status === 'ABSENT' && (
                    <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                      ABSENT
                    </span>
                  )}
                  {student.status === 'UNMARKED' && (
                    <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">
                      UNMARKED
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => onUpdateStatus(student.id, 'PRESENT')}
                      className={`p-1.5 rounded-lg border transition-all ${
                        student.status === 'PRESENT'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 hover:bg-emerald-50 border-slate-200'
                      }`}
                      title="Mark Present"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(student.id, 'LATE')}
                      className={`p-1.5 rounded-lg border transition-all ${
                        student.status === 'LATE'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 hover:bg-amber-50 border-slate-200'
                      }`}
                      title="Mark Late"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(student.id, 'ABSENT')}
                      className={`p-1.5 rounded-lg border transition-all ${
                        student.status === 'ABSENT'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-600 hover:bg-rose-50 border-slate-200'
                      }`}
                      title="Mark Absent"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedStudentForQr(student)}
                      className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative border border-slate-100 flex flex-col items-center text-center">
            <button
              onClick={() => setSelectedStudentForQr(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
              West Bengal Gov. School QR ID Card
            </div>
            <h3 className="text-xl font-black text-slate-800">{selectedStudentForQr.name}</h3>
            <p className="text-sm text-slate-500 font-medium mb-4">{selectedStudentForQr.nameBn}</p>

            {/* Generated QR Card Graphic */}
            <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center w-full">
              <div className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-xl flex items-center justify-center shadow-sm relative">
                {/* SVG Mock QR Code */}
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
              <div className="mt-3 font-mono text-xs text-slate-600 font-bold">
                ROLL: {String(selectedStudentForQr.rollNumber).padStart(4, '0')} | CLASS VIII-A
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                DIGEST: {selectedStudentForQr.qrDigest.slice(0, 16)}...
              </div>
            </div>

            <button
              onClick={() => {
                alert(`Printing QR Card PDF for ${selectedStudentForQr.name}...`);
              }}
              className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Student QR Card</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
