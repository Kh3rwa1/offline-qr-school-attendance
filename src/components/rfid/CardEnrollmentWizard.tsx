import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Search, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../shared/Button';
import { Toast } from '../shared/Toast';

interface StudentItem {
  id: string;
  name?: string;
  fullName?: string;
  nameBn?: string;
  rollNumber?: string | number;
  className?: string;
  sectionName?: string;
  studentCode?: string;
}

export default function CardEnrollmentWizard({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [badgeCode, setBadgeCode] = useState('');
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

  // Mutation: Enroll Student Badge
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !badgeCode.trim()) {
        throw new Error('Please choose a student and enter a badge code');
      }
      return api<{ success: boolean; credential: any }>(`/api/v1/schools/${schoolId}/rfid/credentials/enroll-epc`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          epc: badgeCode.trim(),
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid'] });
      setEnrolledResult(data.credential);
      setStep(3);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to give badge');
    },
  });

  const students = studentsData || [];

  const handleReset = () => {
    setStep(1);
    setSelectedStudent(null);
    setBadgeCode('');
    setStudentSearch('');
    setFormError(null);
    setEnrolledResult(null);
  };

  const cleanCode = badgeCode.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  const lastFour = cleanCode.length >= 4 ? cleanCode.slice(-4) : '****';
  const studentName = selectedStudent?.name || selectedStudent?.fullName || 'Student';

  return (
    <div className="app-card p-6 sm:p-8 max-w-2xl mx-auto text-left">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">Give This Student a Badge</h2>
          <p className="t-body text-xs text-ink-soft mt-0.5">Step {step} of 2</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
          Student Badge
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
              1. Search student by name or roll number
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
            {students.map((st) => {
              const name = st.name || st.fullName || 'Student';
              return (
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
                    <span className="font-extrabold text-ink block text-xs font-display">{name}</span>
                    <span className="text-[11px] text-ink-muted font-medium">
                      {st.className ? `${st.className} – ${st.sectionName}` : 'Student'} • Roll: #{st.rollNumber || '—'}
                    </span>
                  </div>
                  {selectedStudent?.id === st.id && (
                    <CheckCircle2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
                  )}
                </button>
              );
            })}

            {studentSearch.trim().length >= 2 && students.length === 0 && !isSearching && (
              <div className="p-4 text-center text-xs text-ink-muted font-medium">
                No matching students found.
              </div>
            )}

            {studentSearch.trim().length < 2 && (
              <div className="p-4 text-center text-xs text-ink-muted font-medium">
                Type at least 2 characters to search student list.
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
              Next: Paste Badge Code
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Input Badge Code */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block t-label text-ink mb-1 font-display">
              2. Paste or Enter Badge Code
            </label>
            <p className="t-body text-xs text-ink-soft mb-3">
              Scan the student badge or type the code printed on the card.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                required
                value={badgeCode}
                onChange={(e) => setBadgeCode(e.target.value)}
                placeholder="e.g. E28011700000020B85794820"
                className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink font-mono focus:bg-surface focus:border-forest-700 outline-none"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">
                  Badge Ending In: <strong className="font-mono text-forest-700 dark:text-forest-600">•••• {lastFour}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink-muted">Student:</span>
              <strong className="text-ink font-display">{studentName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Class & Roll:</span>
              <strong className="text-ink font-display">
                #{selectedStudent?.rollNumber || '—'} {selectedStudent?.className ? `(${selectedStudent?.className} - ${selectedStudent?.sectionName})` : ''}
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
              disabled={enrollMutation.isPending || cleanCode.length < 4}
              isLoading={enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
            >
              {enrollMutation.isPending ? 'Saving…' : 'Save & Give Badge'}
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
            Badge Given to Student!
          </h3>
          <p className="t-body text-xs text-ink-soft max-w-sm mx-auto">
            <strong>{studentName}</strong> has been given badge ending in <span className="font-mono font-bold text-forest-700 dark:text-forest-600">•••• {enrolledResult?.epcLastFour || lastFour}</span>.
          </p>

          <div className="pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleReset}
            >
              Give Another Badge
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
