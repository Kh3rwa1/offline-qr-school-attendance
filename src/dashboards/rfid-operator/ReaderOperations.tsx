import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import ReaderManagement from '../../components/rfid/ReaderManagement';

export const ReaderOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="reader-operations-view">
      {/* Header */}
      <div className="bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
          {t('schoolGatesTitle')}
        </h1>
        <p className="t-body text-xs text-ink-soft mt-1">
          {language === 'bn' ? `${activeSchoolName}-এ স্থাপিত গেটের ডিভাইস পরিচালনা করুন।` : `Manage attendance gate boxes installed at ${activeSchoolName}.`}
        </p>
      </div>

      {/* Embedded Component */}
      {activeSchoolId && <ReaderManagement schoolId={activeSchoolId} />}
    </div>
  );
};

export default ReaderOperations;
