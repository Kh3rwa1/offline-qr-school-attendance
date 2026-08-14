import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Shield, ShieldAlert, Wifi, Search, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    // Generate a compliant 32-character hex digest for authorized testing
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
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto text-left">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 font-display">DESFire Smartcard Enrollment</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Step {step} of 3 • AES-CMAC Key Personalization</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#144e39]/10 text-[#144e39] font-display">
          Hardware Security Module
        </span>
      </div>

      {formError && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Step 1: Select Student */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
              1. Search Student from Registry
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Type student name or roll number"
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#144e39] outline-none transition-all"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl max-h-56 overflow-y-auto">
            {students.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setSelectedStudent(st);
                  setFormError(null);
                }}
                className={`w-full p-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  selectedStudent?.id === st.id ? 'bg-[#144e39]/10 border-l-4 border-[#144e39]' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="font-extrabold text-slate-900 block text-xs font-display">{st.fullName}</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {st.className ? `${st.className} – ${st.sectionName}` : 'Enrolled Student'} • Roll: #{st.rollNumber || '—'}
                  </span>
                </div>
                {selectedStudent?.id === st.id && (
                  <CheckCircle2 className="w-4 h-4 text-[#144e39]" />
                )}
              </button>
            ))}

            {studentSearch.trim().length >= 2 && students.length === 0 && !isSearching && (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                No matching students found in this school registry.
              </div>
            )}

            {studentSearch.trim().length < 2 && (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                Type at least 2 characters to search student directory.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={!selectedStudent}
              onClick={() => setStep(2)}
              className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>Next: Security Mode</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Security Mode */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 font-display">
              2. Select Smartcard Cryptographic Standard
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSecurityMode('SECURE')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  securityMode === 'SECURE'
                    ? 'border-[#144e39] bg-emerald-50/50 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-[#144e39] mb-2 font-extrabold font-display text-sm">
                  <Shield className="w-5 h-5" />
                  <span>SECURE (AES-CMAC)</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Hardware EV2/EV3 CMAC proof with diversified master keys. Zero clone vulnerability.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSecurityMode('UID_LEGACY')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  securityMode === 'UID_LEGACY'
                    ? 'border-amber-500 bg-amber-50/50 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-amber-700 mb-2 font-extrabold font-display text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>UID_LEGACY (Fallback)</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Plain UID read without crypto challenges. For legacy migration only.
                </p>
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>Next: Read Card</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Card Digest Transceive / Input */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
              3. Transceive Card Digest
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Tap the physical smartcard against the enrollment USB reader or generate a test digest.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                required
                value={credentialDigest}
                onChange={(e) => setCredentialDigest(e.target.value)}
                placeholder="e.g. 7F3A9C8E4D2B1A0F"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-[#144e39] outline-none"
              />

              {Boolean((import.meta as any).env?.DEV) && (
                <button
                  type="button"
                  onClick={handleGenerateDigest}
                  className="text-xs font-bold text-amber-700 hover:underline font-display flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>[DEV SIMULATION] Generate Test Card Digest</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Target Student:</span>
              <strong className="text-slate-900">{selectedStudent?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Security Mode:</span>
              <strong className="text-[#144e39]">{securityMode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Key Version:</span>
              <strong className="text-slate-900">v{keyVersion}</strong>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              disabled={enrollMutation.isPending || !credentialDigest.trim()}
              onClick={() => enrollMutation.mutate()}
              className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {enrollMutation.isPending ? 'Enrolling in Database…' : 'Enroll Smartcard'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success Screen */}
      {step === 4 && (
        <div className="py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#144e39] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 font-display">
            Card Enrolled Successfully!
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Student <strong>{selectedStudent?.fullName}</strong> is now linked to smartcard digest <span className="font-mono">{credentialDigest}</span>.
          </p>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md cursor-pointer"
            >
              Enroll Another Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
