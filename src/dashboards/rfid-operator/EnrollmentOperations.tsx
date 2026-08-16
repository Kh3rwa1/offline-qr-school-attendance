import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';

export const EnrollmentOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="enrollment-operations-view">
      {/* Header */}
      <div className="bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
          {t('giveBadgeTitle')}
        </h1>
        <p className="t-body text-xs text-ink-soft mt-1">
          {language === 'bn' ? `${activeSchoolName}-এর শিক্ষার্থীদের জন্য নতুন ব্যাজ যুক্ত করুন।` : `Link attendance cards to students at ${activeSchoolName}.`}
        </p>
      </div>

      {/* Wizard */}
      {activeSchoolId && <CardEnrollmentWizard schoolId={activeSchoolId} />}
    </div>
  );
};

export default EnrollmentOperations;
