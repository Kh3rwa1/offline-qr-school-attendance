import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { Search, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, User } from 'lucide-react';
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
  const { language, t } = useLanguage();
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
        throw new Error(language === 'bn' ? 'অনুগ্রহ করে শিক্ষার্থী নির্বাচন করুন এবং ব্যাজ কোড লিখুন' : 'Please choose a student and enter a badge code');
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
      const safeErr = getUserSafeError(err, language);
      setFormError(safeErr.message);
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
  const studentName = selectedStudent?.name || selectedStudent?.fullName || (language === 'bn' ? 'শিক্ষার্থী' : 'Student');

  return (
    <div className="app-card p-6 sm:p-8 max-w-2xl mx-auto text-left bg-surface border border-line rounded-3xl shadow-xs">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">
            {t('giveStudentBadge')}
          </h2>
          <p className="t-body text-xs text-ink-soft mt-0.5">
            {language === 'bn' ? `ধাপ ${step} (মোট ৩)` : `Step ${step} of 3`}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
          {t('studentBadge')}
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
            <label className="block t-label text-ink mb-1.5 font-display text-xs font-bold">
              {t('giveBadgeStep1')}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={t('searchStudentPlaceholder')}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-ink-muted focus:bg-surface focus:border-forest-700 outline-none transition-all min-h-[44px]"
              />
            </div>
          </div>

          <div className="divide-y divide-line border border-line rounded-2xl max-h-60 overflow-y-auto bg-surface">
            {students.map((st) => {
              const name = (language === 'bn' && st.nameBn) ? st.nameBn : (st.name || st.fullName || 'Student');
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudent(st);
                    setStep(2);
                  }}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-forest-50/60 transition-colors cursor-pointer group min-h-[44px]"
                >
                  <div>
                    <div className="text-xs font-bold text-ink font-display">{name}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      {st.className ? `${st.className} - ${st.sectionName || 'A'}` : ''} • {t('roll')}: {st.rollNumber || '—'}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
                </button>
              );
            })}
            {studentSearch.trim().length >= 2 && students.length === 0 && !isSearching && (
              <div className="p-6 text-center text-xs text-ink-soft">
                {language === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No matching student found.'}
              </div>
            )}
            {studentSearch.trim().length < 2 && (
              <div className="p-6 text-center text-xs text-ink-muted">
                {language === 'bn' ? 'শিক্ষার্থী খুঁজতে নাম অথবা রোল নম্বর টাইপ করুন।' : 'Type at least 2 characters to search for a student.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Enter or Scan Badge Code */}
      {step === 2 && selectedStudent && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-surface-soft border border-line flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-ink font-display">
                {(language === 'bn' && selectedStudent.nameBn) ? selectedStudent.nameBn : (selectedStudent.name || selectedStudent.fullName || 'Student')}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                {selectedStudent.className} - {selectedStudent.sectionName} • {t('roll')}: {selectedStudent.rollNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-forest-700 dark:text-forest-600 font-bold hover:underline font-display cursor-pointer"
            >
              {language === 'bn' ? 'পরিবর্তন করুন' : 'Change'}
            </button>
          </div>

          <div>
            <label className="block t-label text-ink mb-1.5 font-display text-xs font-bold">
              {t('giveBadgeStep2')}
            </label>
            <input
              type="text"
              value={badgeCode}
              onChange={(e) => setBadgeCode(e.target.value)}
              placeholder={t('badgeCodePlaceholder')}
              autoFocus
              className="w-full px-4 py-3 rounded-2xl bg-surface-soft border border-line text-xs font-mono font-bold text-ink placeholder:text-ink-muted focus:bg-surface focus:border-forest-700 outline-none transition-all min-h-[44px]"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setStep(1)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              className="min-h-[44px] rounded-2xl font-display"
            >
              {t('back')}
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => enrollMutation.mutate()}
              disabled={!badgeCode.trim() || enrollMutation.isPending}
              isLoading={enrollMutation.isPending}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="min-h-[44px] rounded-2xl font-display"
            >
              {language === 'bn' ? 'ব্যাজ নিশ্চিত করুন' : 'Confirm Badge'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Success Confirmation */}
      {step === 3 && (
        <div className="py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center mx-auto border border-success-100 dark:border-success-600/30">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-ink font-display">
              {t('giveBadgeSuccess')}
            </h3>
            <p className="t-body text-xs text-ink-soft mt-1">
              {studentName} {language === 'bn' ? 'কে নতুন ব্যাজ প্রদান করা হয়েছে।' : 'has been assigned a student badge.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line text-left max-w-sm mx-auto space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-ink-muted">{t('student')}:</span>
              <span className="font-bold text-ink">{studentName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink-muted">{t('studentBadge')}:</span>
              <span className="font-mono font-bold text-ink">•••• {lastFour}</span>
            </div>
          </div>

          <div className="pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleReset}
              className="min-h-[44px] rounded-2xl font-display mx-auto"
            >
              {t('assignAnotherBadge')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
