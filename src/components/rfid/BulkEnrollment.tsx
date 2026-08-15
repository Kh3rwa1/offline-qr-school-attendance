import React, { useState } from 'react';
import { Upload, AlertTriangle, AlertCircle } from 'lucide-react';
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
          if (lines.length < 2) throw new Error('CSV must contain a header row and at least 1 data row');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const studentIdIdx = headers.indexOf('studentid');
          const digestIdx = headers.indexOf('credentialdigest') !== -1 ? headers.indexOf('credentialdigest') : headers.indexOf('digest');
          const modeIdx = headers.indexOf('securitymode') !== -1 ? headers.indexOf('securitymode') : headers.indexOf('mode');
          const versionIdx = headers.indexOf('keyversion') !== -1 ? headers.indexOf('keyversion') : headers.indexOf('version');

          if (studentIdIdx === -1 || digestIdx === -1) {
            throw new Error('CSV header must include at least "studentId" and "credentialDigest" columns');
          }

          const entries = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
            if (cols.length > studentIdIdx && cols.length > digestIdx) {
              entries.push({
                studentId: cols[studentIdIdx],
                credentialDigest: cols[digestIdx],
                securityMode: modeIdx !== -1 && cols[modeIdx] === 'UID_LEGACY' ? 'UID_LEGACY' : 'SECURE',
                keyVersion: versionIdx !== -1 ? parseInt(cols[versionIdx], 10) || 1 : 1,
              });
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
      setParseError(err.message || 'Bulk enrollment failed');
    },
  });

  return (
    <div className="app-card p-6 max-w-3xl mx-auto text-left">
      <h2 className="text-xl font-extrabold text-ink font-display mb-2">Bulk Smartcard Provisioning</h2>
      <p className="t-body text-xs text-ink-soft mb-6 font-medium">Batch-enroll DESFire smartcards for multiple students simultaneously.</p>

      <div className="bg-warning-50 p-4 rounded-2xl flex gap-3 mb-6 border border-warning-100 dark:border-warning-600/30">
        <AlertTriangle className="text-warning-800 shrink-0 w-5 h-5" />
        <div className="text-xs text-warning-800">
          <p className="font-bold font-display">Cryptographic Digest Requirement</p>
          <p className="mt-0.5">Upload pre-computed SHA-256 card digests. Never transmit raw un-diversified master keys.</p>
        </div>
      </div>

      {parseError && (
        <div className="mb-5">
          <Toast kind="error" message={parseError} onDismiss={() => setParseError(null)} autoDismiss={false} />
        </div>
      )}

      {results.length === 0 ? (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-line rounded-2xl p-8 text-center bg-surface-soft">
            <Upload className="w-8 h-8 text-ink-muted mx-auto mb-2" />
            <p className="text-xs text-ink font-bold mb-1 font-display">Select JSON or CSV Batch File</p>
            <p className="text-[11px] text-ink-muted mb-3 font-mono">Columns: studentId, credentialDigest, securityMode, keyVersion</p>
            <input
              type="file"
              onChange={handleUpload}
              className="text-xs text-ink-soft cursor-pointer"
              accept=".csv,.json"
            />
          </div>

          {parsedEntries.length > 0 && (
            <div className="p-4 rounded-2xl bg-surface-soft border border-line flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-ink font-display">Ready for Provisioning</p>
                <p className="text-[11px] text-ink-muted font-mono">{parsedEntries.length} valid credential records parsed</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkMutation.isPending}
                isLoading={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate()}
              >
                {bulkMutation.isPending ? 'Enrolling Batch…' : `Enroll ${parsedEntries.length} Cards`}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-surface-soft p-3 rounded-2xl border border-line text-center">
              <div className="text-xl font-extrabold text-ink font-display font-mono">{results.length}</div>
              <div className="text-[11px] text-ink-muted font-bold">Total Batch</div>
            </div>
            <div className="bg-success-50 p-3 rounded-2xl border border-success-100 dark:border-success-600/30 text-center">
              <div className="text-xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">{results.filter(r => r.success).length}</div>
              <div className="text-[11px] text-forest-700 dark:text-forest-600 font-bold">Enrolled</div>
            </div>
            <div className="bg-danger-50 p-3 rounded-2xl border border-danger-100 dark:border-danger-600/30 text-center">
              <div className="text-xl font-extrabold text-danger-800 font-display font-mono">{results.filter(r => !r.success).length}</div>
              <div className="text-[11px] text-danger-800 font-bold">Failed / Duplicate</div>
            </div>
          </div>

          <div className="max-h-64 overflow-auto border border-line rounded-2xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase sticky top-0 font-display">
                <tr>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Message / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                {results.map((r, i) => (
                  <tr key={i} className="table-row-hover">
                    <td className="p-3 font-mono text-ink">{r.studentId}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${
                        r.success ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30' : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                      }`}>
                        {r.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="p-3 text-ink-soft">{r.error || (r.success ? 'Enrolled in database' : 'Failed')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setResults([]);
              setParsedEntries([]);
              setFile(null);
            }}
          >
            Upload Another Batch
          </Button>
        </div>
      )}
    </div>
  );
}
