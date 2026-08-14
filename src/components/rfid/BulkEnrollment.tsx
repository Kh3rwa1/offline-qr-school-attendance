import React, { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

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
    <div className="bg-white p-6 rounded-2xl shadow-sm max-w-3xl mx-auto border border-slate-200 text-left">
      <h2 className="text-xl font-extrabold text-slate-900 font-display mb-2">Bulk Smartcard Provisioning</h2>
      <p className="text-xs text-slate-500 mb-6 font-medium">Batch-enroll DESFire smartcards for multiple students simultaneously.</p>

      <div className="bg-amber-50 p-4 rounded-xl flex gap-3 mb-6 border border-amber-200">
        <AlertTriangle className="text-amber-600 flex-shrink-0 w-5 h-5" />
        <div className="text-xs text-amber-800">
          <p className="font-bold">Cryptographic Digest Requirement</p>
          <p className="mt-0.5">Upload pre-computed SHA-256 card digests. Never transmit raw un-diversified master keys.</p>
        </div>
      </div>

      {parseError && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {results.length === 0 ? (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-700 font-bold mb-1 font-display">Select JSON or CSV Batch File</p>
            <p className="text-[11px] text-slate-400 mb-3">Columns: studentId, credentialDigest, securityMode, keyVersion</p>
            <input
              type="file"
              onChange={handleUpload}
              className="text-xs text-slate-500 cursor-pointer"
              accept=".csv,.json"
            />
          </div>

          {parsedEntries.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 font-display">Ready for Provisioning</p>
                <p className="text-[11px] text-slate-500">{parsedEntries.length} valid credential records parsed</p>
              </div>
              <button
                type="button"
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate()}
                className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                {bulkMutation.isPending ? 'Enrolling Batch…' : `Enroll ${parsedEntries.length} Cards`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
              <div className="text-xl font-extrabold text-slate-900 font-display">{results.length}</div>
              <div className="text-[11px] text-slate-500 font-bold">Total Batch</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-center">
              <div className="text-xl font-extrabold text-[#144e39] font-display">{results.filter(r => r.success).length}</div>
              <div className="text-[11px] text-emerald-700 font-bold">Enrolled</div>
            </div>
            <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-center">
              <div className="text-xl font-extrabold text-rose-700 font-display">{results.filter(r => !r.success).length}</div>
              <div className="text-[11px] text-rose-600 font-bold">Failed / Duplicate</div>
            </div>
          </div>

          <div className="max-h-64 overflow-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase sticky top-0 font-display">
                <tr>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Message / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="p-3 font-mono text-slate-900">{r.studentId}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-display ${
                        r.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {r.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{r.error || (r.success ? 'Enrolled in database' : 'Failed')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => {
              setResults([]);
              setParsedEntries([]);
              setFile(null);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-full font-bold text-xs font-display text-slate-700 cursor-pointer"
          >
            Upload Another Batch
          </button>
        </div>
      )}
    </div>
  );
}
