import React, { useState } from 'react';
import { Language, Student } from '../types';
import {
  QrCode,
  Printer,
  RefreshCw,
  ShieldAlert,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Check,
  X,
  Search,
} from 'lucide-react';
import { Button } from './shared/Button';

interface HeadmasterDashboardProps {
  students: Student[];
  language: Language;
  onReissueQr: (studentId: string) => void;
  onRevokeQr: (studentId: string) => void;
}

export const HeadmasterDashboard: React.FC<HeadmasterDashboardProps> = ({
  students,
  language,
  onReissueQr,
  onRevokeQr,
}) => {
  const [activeTab, setActiveTab] = useState<'qr-print' | 'qr-security' | 'import' | 'devices'>('qr-print');
  const [selectedClass, setSelectedClass] = useState<string>('Class 10');
  const [selectedSection, setSelectedSection] = useState<string>('Section A');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'warning'; msg: string } | null>(null);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);

  // Filter students for print section
  const classStudents = students.filter(
    (s) => s.className === selectedClass && s.section === selectedSection
  );

  // Filter students for security search
  const securityStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.rollNumber.toString().includes(searchTerm)
  );

  const showToast = (type: 'success' | 'warning', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  const handlePrintA4Sheet = () => {
    setIsGeneratingSheet(true);
    setTimeout(() => {
      setIsGeneratingSheet(false);

      // Construct print HTML payload window
      const printWindow = window.open('', '_blank', 'width=900,height=1000');
      if (!printWindow) {
        showToast('warning', language === 'bn' ? 'পপ-আপ উইন্ডো অবরুদ্ধ!' : 'Pop-up window was blocked! Allow pop-ups to print cards.');
        return;
      }

      const cardsHtml = classStudents
        .map(
          (student) => `
          <div style="border: 1.5px solid rgb(20, 78, 57); border-radius: 8px; padding: 10px; background: rgb(255, 255, 255); width: 46%; margin: 1.5%; display: inline-block; box-sizing: border-box; vertical-align: top; font-family: sans-serif;">
            <div style="text-align: center; border-bottom: 1px solid rgb(226, 232, 240); padding-bottom: 4px; margin-bottom: 6px;">
              <div style="font-size: 11px; font-weight: bold; color: rgb(15, 23, 42); text-transform: uppercase;">HARIPUR GOV. HIGH SCHOOL</div>
              <div style="font-size: 8px; color: rgb(71, 85, 105);">STUDENT OFFICIAL QR ID CARD</div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 45px; height: 55px; border: 1px dashed rgb(148, 163, 184); border-radius: 4px; background: rgb(248, 250, 252); display: flex; align-items: center; justify-content: center; font-size: 8px; color: rgb(148, 163, 184); font-weight: bold;">
                PHOTO
              </div>
              <div style="flex: 1; font-size: 10px; line-height: 1.3;">
                <div style="font-size: 12px; font-weight: bold; color: rgb(20, 78, 57);">${student.name}</div>
                <div style="font-size: 10px; color: rgb(71, 85, 105);">${student.nameBn}</div>
                <div style="color: rgb(51, 65, 85); margin-top: 2px;"><strong>Code:</strong> ${student.studentCode}</div>
                <div style="color: rgb(51, 65, 85);"><strong>Class:</strong> ${student.className} (${student.section})</div>
                <div style="color: rgb(51, 65, 85);"><strong>Roll:</strong> #${student.rollNumber}</div>
              </div>
              <div style="width: 70px; height: 70px; background: rgb(241, 245, 249); padding: 4px; border-radius: 4px; border: 1px solid rgb(203, 213, 225); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 7px; color: rgb(71, 85, 105); font-weight: bold; margin-bottom: 2px;">SECURE QR</div>
                <div style="font-size: 9px; font-family: monospace; word-break: break-all; text-align: center; color: rgb(15, 23, 42);">[QR CODE]</div>
              </div>
            </div>
          </div>
        `
        )
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>A4 QR ID Cards - Haripur Gov. High School</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              body { margin: 0; padding: 0; background: white; }
              .header { text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid rgb(20, 78, 57); }
            </style>
          </head>
          <body>
            <div class="header">
              <h2 style="margin: 0; font-family: sans-serif; color: rgb(15, 23, 42);">Haripur Gov. High School - Student ID Cards Batch</h2>
              <p style="margin: 4px 0 0 0; font-family: sans-serif; font-size: 12px; color: rgb(100, 116, 139);">Class: ${selectedClass} | Section: ${selectedSection} | Total Cards: ${classStudents.length}</p>
            </div>
            <div>${cardsHtml}</div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      showToast(
        'success',
        language === 'bn'
          ? `${classStudents.length} টি QR আইডি কার্ড প্রিন্ট উইন্ডোতে পাঠানো হয়েছে!`
          : `A4 Print Sheet generated for ${classStudents.length} students!`
      );
    }, 600);
  };

  return (
    <div className="app-card p-5 md:p-6 mb-6 text-left">
      {/* Dashboard Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-surface-soft text-forest-700 dark:text-forest-600 font-bold px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wider border border-line font-display">
              {language === 'bn' ? 'প্রধান শিক্ষক ড্যাশবোর্ড' : 'Headmaster Admin Portal'}
            </span>
            <span className="w-2 h-2 rounded-full bg-success-600 animate-pulse"></span>
          </div>
          <h2 className="text-xl font-extrabold text-ink mt-1 font-display">
            {language === 'bn' ? 'আইডি কার্ড ও শিক্ষার্থী ব্যবস্থাপনা' : 'ID Card & Student Administration'}
          </h2>
        </div>

        {/* Toast Alert Notification */}
        {notification && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold shadow-2xs transition-all ${
              notification.type === 'success'
                ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                : 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-success-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning-600" />
            )}
            <span>{notification.msg}</span>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 mt-5 border-b border-line pb-3">
        <button
          onClick={() => setActiveTab('qr-print')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer font-display ${
            activeTab === 'qr-print'
              ? 'bg-forest-700 text-white shadow-2xs'
              : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>{language === 'bn' ? 'QR আইডি প্রিন্ট (A4)' : 'QR Card A4 Printing'}</span>
        </button>

        <button
          onClick={() => setActiveTab('qr-security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer font-display ${
            activeTab === 'qr-security'
              ? 'bg-forest-700 text-white shadow-2xs'
              : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{language === 'bn' ? 'পুনরায় ইস্যু ও বাতিল' : 'Re-issue & Revoke QR'}</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer font-display ${
            activeTab === 'import'
              ? 'bg-forest-700 text-white shadow-2xs'
              : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>{language === 'bn' ? 'CSV রোস্টার ইমপোর্ট' : 'Roster CSV Import'}</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer font-display ${
            activeTab === 'devices'
              ? 'bg-forest-700 text-white shadow-2xs'
              : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>{language === 'bn' ? 'অনুমোদিত ডিভাইস' : 'Authorized Devices'}</span>
        </button>
      </div>

      {/* Tab 1: QR Card A4 Printing */}
      {activeTab === 'qr-print' && (
        <div className="mt-6">
          <div className="bg-surface-soft border border-line p-4 rounded-2xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block t-label text-ink-muted mb-1 font-display">
                  {language === 'bn' ? 'শ্রেণী নির্বাচন করুন' : 'Select Class'}
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-surface border border-line rounded-full px-3.5 py-2 text-xs font-semibold text-ink focus:border-forest-700 outline-none"
                >
                  <option value="Class 10">Class 10 (দশম শ্রেণী)</option>
                  <option value="Class 9">Class 9 (নবম শ্রেণী)</option>
                  <option value="Class 8">Class 8 (অষ্টম শ্রেণী)</option>
                </select>
              </div>

              <div>
                <label className="block t-label text-ink-muted mb-1 font-display">
                  {language === 'bn' ? 'শাখা' : 'Section'}
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="bg-surface border border-line rounded-full px-3.5 py-2 text-xs font-semibold text-ink focus:border-forest-700 outline-none"
                >
                  <option value="Section A">Section A (ক শাখা)</option>
                  <option value="Section B">Section B (খ শাখা)</option>
                </select>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handlePrintA4Sheet}
              disabled={isGeneratingSheet || classStudents.length === 0}
              isLoading={isGeneratingSheet}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              {language === 'bn'
                ? `A4 শীট প্রিন্ট করুন (${classStudents.length} জন)`
                : `Generate & Print A4 Sheet (${classStudents.length} Cards)`}
            </Button>
          </div>

          {/* Cards Grid Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classStudents.map((student) => (
              <div
                key={student.id}
                className="border border-line rounded-2xl p-4 bg-surface shadow-2xs hover:border-forest-700/50 transition-all flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="t-label text-ink-muted">
                      {student.className} ({student.section})
                    </span>
                    <h4 className="font-bold text-sm text-ink leading-tight font-display">
                      {student.name}
                    </h4>
                    <p className="text-xs text-ink-soft font-medium">{student.nameBn}</p>
                  </div>
                  <span className="bg-surface-soft text-forest-700 dark:text-forest-600 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border border-line">
                    Roll: #{student.rollNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-line">
                  <div className="text-[11px] text-ink-muted font-mono">
                    ID: {student.studentCode}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-success-800 bg-success-50 px-2 py-0.5 rounded-full border border-success-100 dark:border-success-600/30">
                    <QrCode className="w-3 h-3" />
                    <span>QR Ready</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: QR Re-issue & Revoke */}
      {activeTab === 'qr-security' && (
        <div className="mt-6">
          <div className="relative mb-6">
            <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={
                language === 'bn'
                  ? 'শিক্ষার্থীর নাম, রোল নম্বর বা কোড দিয়ে অনুসন্ধান করুন...'
                  : 'Search by student name, roll number, or code...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-soft border border-line rounded-full pl-10 pr-4 py-2.5 text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none"
            />
          </div>

          <div className="overflow-x-auto border border-line rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-soft text-ink-muted font-bold uppercase tracking-wider border-b border-line font-display">
                  <th className="p-3">Roll</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">QR Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {securityStudents.map((s) => (
                  <tr key={s.id} className="table-row-hover">
                    <td className="p-3 font-mono font-bold text-ink">#{s.rollNumber}</td>
                    <td className="p-3">
                      <div className="font-bold text-ink font-display">{s.name}</div>
                      <div className="text-[11px] text-ink-soft">{s.nameBn}</div>
                    </td>
                    <td className="p-3 font-medium text-ink-soft">
                      {s.className} ({s.section})
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-bold text-[11px] px-2.5 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Active (v1)
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            onReissueQr(s.id);
                            showToast(
                              'success',
                              language === 'bn'
                                ? `${s.nameBn}-এর জন্য নতুন QR সিক্রেট ইস্যু করা হয়েছে!`
                                : `New QR Key re-issued for ${s.name}! Old key invalidated.`
                            );
                          }}
                          className="flex items-center gap-1 bg-warning-50 hover:bg-warning-100 text-warning-800 border border-warning-100 dark:border-warning-600/30 px-3 py-1 rounded-full font-bold text-[11px] cursor-pointer"
                          title="Re-issue new secret QR key (invalidates lost card)"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{language === 'bn' ? 'পুনরায় ইস্যু' : 'Re-issue'}</span>
                        </button>
                        <button
                          onClick={() => {
                            onRevokeQr(s.id);
                            showToast(
                              'warning',
                              language === 'bn'
                                ? `${s.nameBn}-এর QR সিক্রেট বাতিল করা হয়েছে!`
                                : `QR key revoked for ${s.name}!`
                            );
                          }}
                          className="flex items-center gap-1 bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-100 dark:border-danger-600/30 px-3 py-1 rounded-full font-bold text-[11px] cursor-pointer"
                          title="Permanently revoke active QR key"
                        >
                          <X className="w-3 h-3" />
                          <span>{language === 'bn' ? 'বাতিল করুন' : 'Revoke'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: CSV Roster Import */}
      {activeTab === 'import' && (
        <div className="mt-6">
          <div className="border-2 border-dashed border-line hover:border-forest-700 bg-surface-soft p-8 rounded-2xl text-center transition-all cursor-pointer">
            <div className="w-12 h-12 bg-surface border border-line rounded-2xl flex items-center justify-center text-forest-700 dark:text-forest-600 mx-auto mb-3 shadow-2xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-ink text-sm mb-1 font-display">
              {language === 'bn'
                ? 'শিক্ষার্থী তালিকা ইমপোর্ট করতে ফাইল ড্র্যাগ করুন বা ক্লিক করুন'
                : 'Drag & Drop CSV / Excel Roster File or Click to Browse'}
            </h4>
            <p className="text-xs text-ink-soft max-w-md mx-auto mb-4">
              Supported columns: <code>student_code, banglar_shiksha_id, name, name_bn, class, section, roll_number, phone_number</code>
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                showToast(
                  'success',
                  language === 'bn'
                    ? 'CSV ফরম্যাট চেক করা হয়েছে! ২৫ জন নতুন শিক্ষার্থী ইমপোর্ট সফল।'
                    : 'CSV roster validated! 25 new students imported successfully.'
                )
              }
            >
              {language === 'bn' ? 'নমুনা ফাইল আপলোড সিমুলেট করুন' : 'Upload Sample Roster CSV'}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 4: Authorized Devices */}
      {activeTab === 'devices' && (
        <div className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-line rounded-2xl p-4 bg-surface flex justify-between items-center shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 rounded-2xl flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-ink font-display">Samsung Galaxy Tab A8</h4>
                  <p className="text-xs text-ink-soft">Teacher: Assistant Headmaster (Rahim Sir)</p>
                  <div className="text-[11px] text-success-800 font-bold mt-0.5 font-mono">STATUS: AUTHORIZED</div>
                </div>
              </div>
              <button
                onClick={() => showToast('warning', 'Device revoked from active offline scanners.')}
                className="text-xs text-danger-800 hover:bg-danger-100 font-bold px-3 py-1 rounded-full bg-danger-50 border border-danger-100 dark:border-danger-600/30 cursor-pointer transition-colors"
              >
                Revoke
              </button>
            </div>

            <div className="border border-line rounded-2xl p-4 bg-surface flex justify-between items-center shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 rounded-2xl flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-ink font-display">Redmi Note 12 Scanner</h4>
                  <p className="text-xs text-ink-soft">Teacher: Class 10 Teacher (Kabir Ahmed)</p>
                  <div className="text-[11px] text-success-800 font-bold mt-0.5 font-mono">STATUS: AUTHORIZED</div>
                </div>
              </div>
              <button
                onClick={() => showToast('warning', 'Device revoked from active offline scanners.')}
                className="text-xs text-danger-800 hover:bg-danger-100 font-bold px-3 py-1 rounded-full bg-danger-50 border border-danger-100 dark:border-danger-600/30 cursor-pointer transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeadmasterDashboard;
