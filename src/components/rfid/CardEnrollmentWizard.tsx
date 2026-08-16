import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Radio, Search, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '../shared/Button';
import { Toast } from '../shared/Toast';

interface StudentItem {
  id: string;
  fullName: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
}

export default function CardEnrollmentWizard({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [epcInput, setEpcInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [enrolledResult, setEnrolledResult] = useState<any | null>(null);

  // Query: Student Search
  const { data: studentsData, isLoading: isSearching } = useQuery({
    queryKey: ['schools', schoolId, 'students', 'search', studentSearch],
    queryFn: async () => {
      if (!schoolId) return [];
      const res = await api<{ students?: StudentItem[]; data?: StudentItem[] }>(
        `/api/v1/schools/${schoolId}/students?search=${encodeURIComponent(studentSearch)}&limit=10`
      );
      return res.students || res.data || [];
    },
    enabled: Boolean(schoolId && studentSearch.trim().length >= 2),
  });

  // Mutation: Enroll UHF EPC Credential
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !epcInput.trim()) {
        throw new Error('Student selection and EPC hex code are required');
      }
      return api<{ success: boolean; credential: any }>(`/api/v1/schools/${schoolId}/rfid/credentials/enroll-epc`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          epc: epcInput.trim(),
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid'] });
      setEnrolledResult(data.credential);
      setStep(3);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Enrollment failed');
    },
  });

  const students = studentsData || [];

  const handleGenerateSampleEpc = () => {
    const array = new Uint8Array(12); // Standard 96-bit Gen2 EPC (24 hex chars)
    crypto.getRandomValues(array);
    const hex = 'E280' + Array.from(array.slice(2), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    setEpcInput(hex);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedStudent(null);
    setEpcInput('');
    setStudentSearch('');
    setFormError(null);
    setEnrolledResult(null);
  };

  const cleanEpc = epcInput.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  const lastFour = cleanEpc.length >= 4 ? cleanEpc.slice(-4) : '****';

  return (
    <div className="app-card p-6 sm:p-8 max-w-2xl mx-auto text-left">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">UHF EPC Gen2 Badge Enrollment</h2>
          <p className="t-body text-xs text-ink-soft mt-0.5">Zebra FX9600 Gate Attendance • Step {step} of 2</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5" />
          <span>EPC Class 1 Gen 2</span>
        </span>
      </div>

      {formError && (
        <div className="mb-5">
          <Toast kind="error" message={formError} onDismiss={() => setFormError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Step 1: Select Student */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block t-label text-ink mb-1.5 font-display">
              1. Search Student from School Registry
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Type student name or roll number…"
                className="w-full pl-11 pr-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
              />
            </div>
          </div>

          <div className="divide-y divide-line border border-line rounded-2xl max-h-56 overflow-y-auto bg-surface">
            {students.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setSelectedStudent(st);
                  setFormError(null);
                }}
                className={`w-full p-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  selectedStudent?.id === st.id ? 'bg-success-50/70 border-l-4 border-forest-700' : 'hover:bg-surface-soft'
                }`}
              >
                <div>
                  <span className="font-extrabold text-ink block text-xs font-display">{st.fullName}</span>
                  <span className="text-[11px] text-ink-muted font-medium">
                    {st.className ? `${st.className} – ${st.sectionName}` : 'Enrolled Student'} • Roll: #{st.rollNumber || '—'}
                  </span>
                </div>
                {selectedStudent?.id === st.id && (
                  <CheckCircle2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
                )}
              </button>
            ))}

            {studentSearch.trim().length >= 2 && students.length === 0 && !isSearching && (
              <div className="p-4 text-center text-xs text-ink-muted font-medium">
                No matching students found in this school registry.
              </div>
            )}

            {studentSearch.trim().length < 2 && (
              <div className="p-4 text-center text-xs text-ink-muted font-medium">
                Type at least 2 characters to search student directory.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-line">
            <Button
              variant="primary"
              size="md"
              disabled={!selectedStudent}
              onClick={() => setStep(2)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Next: Enter EPC Badge
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Input / Read EPC Hex */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block t-label text-ink mb-1 font-display">
              2. Read or Enter UHF Tag EPC Hex
            </label>
            <p className="t-body text-xs text-ink-soft mb-3">
              Scan badge using handheld UHF scanner, copy from gate reader live tap, or enter 24/32-character hexadecimal EPC.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                required
                value={epcInput}
                onChange={(e) => setEpcInput(e.target.value)}
                placeholder="e.g. E28011700000020B85794820"
                className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink font-mono focus:bg-surface focus:border-forest-700 outline-none"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">
                  Canonical Length: <strong className="font-mono text-ink">{cleanEpc.length}</strong> hex chars • Last 4: <strong className="font-mono text-forest-700 dark:text-forest-600">{lastFour}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleGenerateSampleEpc}
                  className="text-xs font-bold text-forest-700 hover:underline font-display flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate Test EPC</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink-muted">Target Student:</span>
              <strong className="text-ink font-display">{selectedStudent?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Roll / Class:</span>
              <strong className="text-ink font-display">
                #{selectedStudent?.rollNumber || '—'} ({selectedStudent?.className} - {selectedStudent?.sectionName})
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Privacy Protection:</span>
              <strong className="text-forest-700 dark:text-forest-600 font-display flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 Hashed Vault (Raw EPC is never logged)</span>
              </strong>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-line">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={enrollMutation.isPending || cleanEpc.length < 8}
              isLoading={enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
            >
              {enrollMutation.isPending ? 'Enrolling & Activating…' : 'Enroll & Activate Badge'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Success Screen */}
      {step === 3 && (
        <div className="py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-ink font-display">
            UHF Badge Enrolled & Activated!
          </h3>
          <p className="t-body text-xs text-ink-soft max-w-sm mx-auto">
            Student <strong>{selectedStudent?.fullName}</strong> is now linked to EPC badge ending in <span className="font-mono font-bold text-forest-700 dark:text-forest-600">…{enrolledResult?.epcLastFour || lastFour}</span>.
          </p>

          <div className="p-3 bg-surface-soft border border-line rounded-xl max-w-md mx-auto text-left text-xs space-y-1">
            <div className="flex justify-between text-ink-muted">
              <span>Status:</span>
              <span className="font-bold text-forest-700">ACTIVE</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Digest:</span>
              <span className="font-mono text-[10px] text-ink">{enrolledResult?.credentialDigest ? `${enrolledResult.credentialDigest.slice(0, 16)}…` : 'Calculated'}</span>
            </div>
          </div>

          <div className="pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleReset}
            >
              Enroll Another Badge
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
