import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Button } from '../shared/Button';
import { Toast } from '../shared/Toast';

export default function BulkEnrollment() {
  const { activeSchoolId } = useActiveSchool();
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
            throw new Error('Invalid JSON structure: Expected an array of entries');
          }
        } else {
          // Parse CSV
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) throw new Error('CSV must contain a header row and at least 1 student row');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          
          const studentIdIdx = headers.indexOf('studentid');
          const studentCodeIdx = headers.indexOf('studentcode') !== -1 ? headers.indexOf('studentcode') : headers.indexOf('code');
          const rollNumberIdx = headers.indexOf('rollnumber') !== -1 ? headers.indexOf('rollnumber') : headers.indexOf('roll');
          const epcIdx = headers.indexOf('epc') !== -1 ? headers.indexOf('epc') : (headers.indexOf('badge') !== -1 ? headers.indexOf('badge') : (headers.indexOf('badgecode') !== -1 ? headers.indexOf('badgecode') : headers.indexOf('credentialdigest')));

          if (studentIdIdx === -1 && studentCodeIdx === -1 && rollNumberIdx === -1) {
            throw new Error('CSV header must contain "studentCode", "rollNumber", or "studentId" column');
          }
          if (epcIdx === -1) {
            throw new Error('CSV header must contain "epc" or "badge" column');
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
        setParseError(err.message || 'Failed to parse file');
        setParsedEntries([]);
      }
    }
  };

  const bulkMutation = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || parsedEntries.length === 0) {
        throw new Error('No valid entries to enroll');
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
      setParseError(err.message || 'Bulk badge assignment failed');
    },
  });

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  return (
    <div className="app-card p-6 max-w-3xl mx-auto text-left">
      <h2 className="text-xl font-extrabold text-ink font-display mb-2">Give Badges in Bulk</h2>
      <p className="t-body text-xs text-ink-soft mb-6 font-medium">Upload a list of students and their badge codes to activate them all at once.</p>

      <div className="bg-surface-soft p-4 rounded-2xl border border-line mb-6 text-xs text-ink-soft flex items-start gap-3">
        <FileText className="w-5 h-5 text-forest-700 dark:text-forest-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-ink font-display">Supported CSV Columns</p>
          <p className="mt-1">
            Your CSV should include <code className="font-mono font-bold text-forest-700 bg-surface px-1.5 py-0.5 rounded border border-line">studentCode, epc</code> or <code className="font-mono font-bold text-forest-700 bg-surface px-1.5 py-0.5 rounded border border-line">rollNumber, epc</code>.
          </p>
        </div>
      </div>

      {parseError && (
        <div className="mb-6">
          <Toast kind="error" message={parseError} onDismiss={() => setParseError(null)} autoDismiss={false} />
        </div>
      )}

      {/* File Upload Box */}
      <div className="border-2 border-dashed border-line hover:border-forest-700 p-8 rounded-2xl text-center mb-6 cursor-pointer bg-surface hover:bg-surface-soft transition-colors relative">
        <input
          type="file"
          accept=".csv,.json"
          onChange={handleUpload}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <Upload className="w-8 h-8 text-forest-700 dark:text-forest-600 mx-auto mb-3" />
        <h3 className="font-bold text-ink text-sm font-display mb-1">
          {file ? file.name : 'Choose a CSV file or drag and drop here'}
        </h3>
        <p className="text-[11px] text-ink-muted">Accepts .csv or .json files</p>
      </div>

      {/* Parsed Preview */}
      {parsedEntries.length > 0 && results.length === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink font-display">
              Ready to give badges to {parsedEntries.length} students
            </span>
            <Button
              variant="primary"
              size="md"
              disabled={bulkMutation.isPending}
              isLoading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              {bulkMutation.isPending ? 'Saving Badges…' : `Save ${parsedEntries.length} Badges`}
            </Button>
          </div>

          <div className="max-h-48 overflow-y-auto border border-line rounded-2xl bg-surface divide-y divide-line text-xs font-mono">
            {parsedEntries.slice(0, 10).map((entry, idx) => (
              <div key={idx} className="p-2.5 flex justify-between items-center text-ink-soft">
                <span>{entry.studentCode ? `Code: ${entry.studentCode}` : (entry.rollNumber ? `Roll: #${entry.rollNumber}` : `ID: ${entry.studentId}`)}</span>
                <span className="font-bold text-forest-700 dark:text-forest-600">•••• {entry.epc ? entry.epc.slice(-4) : '****'}</span>
              </div>
            ))}
            {parsedEntries.length > 10 && (
              <div className="p-2 text-center text-ink-muted text-[11px] font-sans">
                …and {parsedEntries.length - 10} more rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4 mt-6">
          <div className="p-4 rounded-2xl bg-surface-soft border border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-forest-700 dark:text-forest-600" />
              <span className="text-xs font-bold text-ink font-display">
                {successCount} badges saved successfully
              </span>
            </div>
            {failureCount > 0 && (
              <span className="text-xs font-bold text-danger-800 bg-danger-50 px-2.5 py-1 rounded-full border border-danger-100 dark:border-danger-600/30">
                {failureCount} errors
              </span>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto border border-line rounded-2xl bg-surface divide-y divide-line text-xs">
            {results.map((r, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink font-display">{r.studentCode ? `Code: ${r.studentCode}` : (r.rollNumber ? `Roll: #${r.rollNumber}` : `Student ${idx + 1}`)}</span>
                  {r.epcLastFour && <span className="text-ink-muted text-[11px] ml-2 font-mono">•••• {r.epcLastFour}</span>}
                </div>
                {r.success ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                    Saved
                  </span>
                ) : (
                  <span className="text-danger-800 text-[11px] font-medium">{r.error}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null);
                setParsedEntries([]);
                setResults([]);
              }}
            >
              Upload Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
