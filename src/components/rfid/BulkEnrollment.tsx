import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileText, Download } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { api } from '../../services/api';
import { Button } from '../shared/Button';
import { Toast } from '../shared/Toast';

export default function BulkEnrollment() {
  const { activeSchoolId } = useActiveSchool();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setResults([]);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      try {
        const text = await selectedFile.text();
        if (selectedFile.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            setParsedEntries(json);
          } else if (json.entries && Array.isArray(json.entries)) {
            setParsedEntries(json.entries);
          } else {
            throw new Error(language === 'bn' ? 'অকার্যকর জেসন ফরম্যাট: একটি তালিকা প্রয়োজন' : 'Invalid JSON structure: Expected an array of entries');
          }
        } else {
          // Parse CSV
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) {
            throw new Error(language === 'bn' ? 'সিএসভি ফাইলে হেডার ও অন্তত ১ জন শিক্ষার্থীর তথ্য থাকতে হবে' : 'CSV must contain a header row and at least 1 student row');
          }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          
          const studentIdIdx = headers.indexOf('studentid');
          const studentCodeIdx = headers.indexOf('studentcode') !== -1 ? headers.indexOf('studentcode') : headers.indexOf('code');
          const rollNumberIdx = headers.indexOf('rollnumber') !== -1 ? headers.indexOf('rollnumber') : headers.indexOf('roll');
          const epcIdx = headers.indexOf('epc') !== -1 ? headers.indexOf('epc') : (headers.indexOf('badge') !== -1 ? headers.indexOf('badge') : (headers.indexOf('badgecode') !== -1 ? headers.indexOf('badgecode') : headers.indexOf('credentialdigest')));

          if (studentIdIdx === -1 && studentCodeIdx === -1 && rollNumberIdx === -1) {
            throw new Error(language === 'bn' ? 'সিএসভি ফাইলে "studentCode", "rollNumber" অথবা "studentId" কলাম থাকতে হবে' : 'CSV header must contain "studentCode", "rollNumber", or "studentId" column');
          }
          if (epcIdx === -1) {
            throw new Error(language === 'bn' ? 'সিএসভি ফাইলে "epc" অথবা "badge" কলাম থাকতে হবে' : 'CSV header must contain "epc" or "badge" column');
          }

          const entries = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
            if (cols.length > epcIdx && cols[epcIdx]) {
              const entry: any = {
                epc: cols[epcIdx],
              };
              if (studentIdIdx !== -1 && cols[studentIdIdx]) entry.studentId = cols[studentIdIdx];
              if (studentCodeIdx !== -1 && cols[studentCodeIdx]) entry.studentCode = cols[studentCodeIdx];
              if (rollNumberIdx !== -1 && cols[rollNumberIdx]) entry.rollNumber = cols[rollNumberIdx];
              entries.push(entry);
            }
          }
          setParsedEntries(entries);
        }
      } catch (err: any) {
        setParseError(err.message || (language === 'bn' ? 'ফাইল পার্স করতে সমস্যা হয়েছে' : 'Failed to parse file'));
        setParsedEntries([]);
      }
    }
  };

  const bulkMutation = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || parsedEntries.length === 0) {
        throw new Error(language === 'bn' ? 'কোনো বৈধ তথ্য পাওয়া যায়নি' : 'No valid entries to enroll');
      }
      return api<{ success: boolean; results: any[] }>(
        `/api/v1/schools/${activeSchoolId}/rfid/credentials/bulk-enroll`,
        {
          method: 'POST',
          body: JSON.stringify({ entries: parsedEntries }),
        }
      );
    },
    onSuccess: (data) => {
      setResults(data.results || []);
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'rfid'] });
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setParseError(safeErr.message);
    },
  });

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  return (
    <div className="app-card p-6 sm:p-8 max-w-3xl mx-auto text-left bg-surface border border-line rounded-3xl shadow-xs">
      <div className="pb-4 mb-6 border-b border-line">
        <h2 className="text-xl font-extrabold text-ink font-display">{t('bulkBadgeAssignment')}</h2>
        <p className="t-body text-xs text-ink-soft mt-0.5">
          {t('bulkBadgeDesc')}
        </p>
      </div>

      {parseError && (
        <div className="mb-5">
          <Toast kind="error" message={parseError} onDismiss={() => setParseError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Upload Box */}
      <div className="border-2 border-dashed border-line rounded-3xl p-8 text-center space-y-4 bg-surface-soft hover:bg-forest-50/30 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-forest-50 text-forest-700 dark:text-forest-600 flex items-center justify-center mx-auto border border-forest-100 dark:border-forest-600/30">
          <Upload className="w-6 h-6" />
        </div>

        <div>
          <label className="cursor-pointer">
            <span className="text-xs font-extrabold text-forest-700 dark:text-forest-600 hover:underline font-display">
              {t('uploadFileBtn')}
            </span>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          <p className="t-body text-[11px] text-ink-muted mt-1">
            {language === 'bn' ? 'প্রয়োজনীয় কলাম: studentCode, epc (বা badge)' : 'Required columns: studentCode, epc (or badge)'}
          </p>
        </div>

        {file && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-line text-xs font-bold text-ink">
            <FileText className="w-4 h-4 text-forest-700 dark:text-forest-600" />
            <span>{file.name}</span>
            <span className="text-[11px] text-ink-muted">({parsedEntries.length} {language === 'bn' ? 'টি এন্ট্রি' : 'rows'})</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {parsedEntries.length > 0 && results.length === 0 && (
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-line">
          <span className="text-xs font-bold text-ink">
            {parsedEntries.length} {language === 'bn' ? 'টি ব্যাজ যুক্ত করার জন্য প্রস্তুত' : 'badges ready to assign'}
          </span>
          <Button
            variant="primary"
            size="md"
            onClick={() => bulkMutation.mutate()}
            isLoading={bulkMutation.isPending}
            className="min-h-[44px] rounded-2xl font-display"
          >
            {t('bulkAssignBtn')}
          </Button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-4 pt-4 border-t border-line">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-ink font-display">
              {language === 'bn' ? 'ফলাফল সারসংক্ষেপ' : 'Enrollment Results'}
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30">
                {successCount} {language === 'bn' ? 'সফল' : 'Success'}
              </span>
              {failureCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30">
                  {failureCount} {language === 'bn' ? 'ব্যর্থ' : 'Failed'}
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-line border border-line rounded-2xl max-h-60 overflow-y-auto bg-surface text-xs">
            {results.map((r, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <span className="font-mono text-ink-muted">•••• {(r.epc || '').slice(-4)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.success ? 'text-forest-700 dark:text-forest-600 font-display' : 'text-danger-800 font-display'}`}>
                  {r.success ? (language === 'bn' ? 'যুক্ত হয়েছে' : 'Enrolled') : (r.error || (language === 'bn' ? 'ব্যর্থ' : 'Failed'))}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setFile(null);
                setParsedEntries([]);
                setResults([]);
              }}
              className="min-h-[44px] rounded-2xl font-display"
            >
              {language === 'bn' ? 'নতুন ফাইল আপলোড করুন' : 'Upload Another File'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
