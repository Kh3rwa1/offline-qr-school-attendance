import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Shield, ShieldAlert, Search, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
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
  const [securityMode, setSecurityMode] = useState<'SECURE' | 'UID_LEGACY'>('SECURE');
  const [credentialDigest, setCredentialDigest] = useState('');
  const [keyVersion, setKeyVersion] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  // Mutation: Enroll Credential
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !credentialDigest) {
        throw new Error('Student and card digest are required');
      }
      return api<{ success: boolean; credential: any }>(`/api/v1/schools/${schoolId}/rfid/credentials/enroll`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          credentialDigest: credentialDigest.trim(),
          securityMode,
          keyVersion,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid'] });
      setIsSuccess(true);
      setStep(4);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Enrollment transaction failed');
    },
  });

  const students = studentsData || [];

  const handleGenerateDigest = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    setCredentialDigest(hex);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedStudent(null);
    setCredentialDigest('');
    setStudentSearch('');
    setFormError(null);
    setIsSuccess(false);
  };

  return (
    <div className="app-card p-6 sm:p-8 max-w-2xl mx-auto text-left">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">DESFire Smartcard Enrollment</h2>
          <p className="t-body text-xs text-ink-soft mt-0.5">Step {step} of 3 • AES-CMAC Key Personalization</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
          Hardware Security Module
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
              1. Search Student from Registry
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Type student name or roll number"
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
              Next: Security Mode
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Security Mode */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block t-label text-ink mb-2 font-display">
              2. Select Smartcard Cryptographic Standard
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSecurityMode('SECURE')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  securityMode === 'SECURE'
                    ? 'border-forest-700 bg-success-50/50 shadow-2xs'
                    : 'border-line hover:border-forest-600/50 bg-surface'
                }`}
              >
                <div className="flex items-center gap-2 text-forest-700 dark:text-forest-600 mb-2 font-extrabold font-display text-sm">
                  <Shield className="w-5 h-5" />
                  <span>SECURE (AES-CMAC)</span>
                </div>
                <p className="t-body text-xs text-ink-soft">
                  Hardware EV2/EV3 CMAC proof with diversified master keys. Zero clone vulnerability.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSecurityMode('UID_LEGACY')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  securityMode === 'UID_LEGACY'
                    ? 'border-warning-600 bg-warning-50/50 shadow-2xs'
                    : 'border-line hover:border-warning-600/50 bg-surface'
                }`}
              >
                <div className="flex items-center gap-2 text-warning-800 mb-2 font-extrabold font-display text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>UID_LEGACY (Fallback)</span>
                </div>
                <p className="t-body text-xs text-ink-soft">
                  Plain UID read without crypto challenges. For legacy migration only.
                </p>
              </button>
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
              onClick={() => setStep(3)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Next: Read Card
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Card Digest Transceive / Input */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label className="block t-label text-ink mb-1 font-display">
              3. Transceive Card Digest
            </label>
            <p className="t-body text-xs text-ink-soft mb-3">
              Tap the physical smartcard against the enrollment USB reader or generate a test digest.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                required
                value={credentialDigest}
                onChange={(e) => setCredentialDigest(e.target.value)}
                placeholder="e.g. 7F3A9C8E4D2B1A0F"
                className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink font-mono focus:bg-surface focus:border-forest-700 outline-none"
              />

              {Boolean((import.meta as any).env?.DEV) && (
                <button
                  type="button"
                  onClick={handleGenerateDigest}
                  className="text-xs font-bold text-warning-800 hover:underline font-display flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>[DEV SIMULATION] Generate Test Card Digest</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-ink-muted">Target Student:</span>
              <strong className="text-ink font-display">{selectedStudent?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Security Mode:</span>
              <strong className="text-forest-700 dark:text-forest-600 font-display">{securityMode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Key Version:</span>
              <strong className="text-ink font-mono">v{keyVersion}</strong>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-line">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={enrollMutation.isPending || !credentialDigest.trim()}
              isLoading={enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
            >
              {enrollMutation.isPending ? 'Enrolling in Database…' : 'Enroll Smartcard'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Success Screen */}
      {step === 4 && (
        <div className="py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-ink font-display">
            Card Enrolled Successfully!
          </h3>
          <p className="t-body text-xs text-ink-soft max-w-sm mx-auto">
            Student <strong>{selectedStudent?.fullName}</strong> is now linked to smartcard digest <span className="font-mono">{credentialDigest}</span>.
          </p>

          <div className="pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleReset}
            >
              Enroll Another Card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
