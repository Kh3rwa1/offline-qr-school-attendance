import { Language } from '../i18n';

export interface RfidRejectionDetail {
  code: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  severity: 'warning' | 'danger' | 'info';
  technicalDetail: string;
}

export function mapRfidRejectionCode(
  rawCode: string | undefined | null,
  lang: Language = 'en'
): RfidRejectionDetail {
  const code = (rawCode || 'UNKNOWN_ANOMALY').toUpperCase().trim();

  // 1. Unknown / Unregistered Badge
  if (
    code.includes('CARD_NOT_FOUND') ||
    code.includes('UNKNOWN_CARD') ||
    code.includes('UNKNOWN_EPC_TAG') ||
    code.includes('NO_CREDENTIAL_DIGEST') ||
    code.includes('UNREGISTERED')
  ) {
    if (lang === 'bn') {
      return {
        code,
        title: 'অচেনা ব্যাজ',
        explanation: 'এই ব্যাজটি বিদ্যালয়ের কোনো ছাত্র/ছাত্রীর নামে যুক্ত করা নেই।',
        recommendedAction: 'ছাত্রের নাম দিয়ে নতুন ব্যাজ যুক্ত করুন।',
        severity: 'warning',
        technicalDetail: `Server rejection: ${code}. No active credential digest match found in school tenant records.`,
      };
    }
    return {
      code,
      title: 'Unknown badge',
      explanation: 'This badge is not registered to any student in this school.',
      recommendedAction: 'Give this badge to the student from the "Give Badge" screen.',
      severity: 'warning',
      technicalDetail: `Server rejection: ${code}. No active credential digest match found in school tenant records.`,
    };
  }

  // 2. Stopped / Suspended Badge
  if (code.includes('SUSPENDED') || code.includes('CARD_SUSPENDED')) {
    if (lang === 'bn') {
      return {
        code,
        title: 'ব্যাজটি সাময়িকভাবে বন্ধ আছে',
        explanation: 'এই ব্যাজটি পূর্বে সাময়িকভাবে স্থগিত করা হয়েছিল।',
        recommendedAction: 'ব্যাজ তালিকায় গিয়ে ব্যাজটি পুনরায় সক্রিয় করুন।',
        severity: 'warning',
        technicalDetail: `Server rejection: ${code}. Credential state is SUSPENDED.`,
      };
    }
    return {
      code,
      title: 'Badge has been stopped',
      explanation: 'This badge was temporarily suspended by a school administrator.',
      recommendedAction: 'Re-activate the card from the Student Badges management panel.',
      severity: 'warning',
      technicalDetail: `Server rejection: ${code}. Credential state is SUSPENDED.`,
    };
  }

  // 3. Cancelled / Revoked Badge
  if (code.includes('REVOKED') || code.includes('CARD_REVOKED')) {
    if (lang === 'bn') {
      return {
        code,
        title: 'ব্যাজটি বাতিল করা হয়েছে',
        explanation: 'এই ব্যাজটি স্থায়ীভাবে বাতিল করা হয়েছে (হারিয়ে যাওয়া বা স্থানান্তরের কারণে)।',
        recommendedAction: 'শিক্ষার্থীকে নতুন একটি ব্যাজ দিন।',
        severity: 'danger',
        technicalDetail: `Server rejection: ${code}. Credential state is REVOKED.`,
      };
    }
    return {
      code,
      title: 'Badge permanently cancelled',
      explanation: 'This badge was marked as lost, damaged, or permanently cancelled.',
      recommendedAction: 'Issue a replacement badge to the student.',
      severity: 'danger',
      technicalDetail: `Server rejection: ${code}. Credential state is REVOKED.`,
    };
  }

  // 4. Repeated / Duplicate Scan
  if (
    code.includes('NONCE_REUSED') ||
    code.includes('REPLAY_DETECTED') ||
    code.includes('DUPLICATE_SCAN') ||
    code.includes('ALREADY_SCANNED')
  ) {
    if (lang === 'bn') {
      return {
        code,
        title: 'একই ব্যাজ একাধিকবার স্ক্যান হয়েছে',
        explanation: 'এই শিক্ষার্থী আজ ইতিমধ্যে গেট দিয়ে প্রবেশ করেছে।',
        recommendedAction: 'কোনো ব্যবস্থা নেওয়ার প্রয়োজন নেই। শিক্ষার্থীর উপস্থিতি সংরক্ষিত আছে।',
        severity: 'info',
        technicalDetail: `Server rejection: ${code}. Monotonic counter or duplicate punch window prevented re-logging.`,
      };
    }
    return {
      code,
      title: 'Repeated badge read',
      explanation: 'This student has already walked in through the gate today.',
      recommendedAction: 'No action needed. The student is already marked present.',
      severity: 'info',
      technicalDetail: `Server rejection: ${code}. Monotonic counter or duplicate punch window prevented re-logging.`,
    };
  }

  // 5. Wrong School / Tenant Mismatch
  if (code.includes('TENANT_MISMATCH') || code.includes('WRONG_SCHOOL')) {
    if (lang === 'bn') {
      return {
        code,
        title: 'অন্য বিদ্যালয়ের ব্যাজ',
        explanation: 'এই ব্যাজটি অন্য কোনো বিদ্যালয়ের শিক্ষার্থীর জন্য বরাদ্দ।',
        recommendedAction: 'শিক্ষার্থীর কার্ডটি পরীক্ষা করুন এবং সঠিক বিদ্যালয়ের কার্ড প্রদান করুন।',
        severity: 'danger',
        technicalDetail: `Server rejection: ${code}. Credential issuer schoolId does not match current tenant.`,
      };
    }
    return {
      code,
      title: 'Wrong school badge',
      explanation: 'This badge was issued by another school.',
      recommendedAction: 'Verify the card and issue a badge for this school.',
      severity: 'danger',
      technicalDetail: `Server rejection: ${code}. Credential issuer schoolId does not match current tenant.`,
    };
  }

  // 6. Generic / Fallback
  if (lang === 'bn') {
    return {
      code,
      title: 'গেটে স্ক্যান সমস্যা',
      explanation: 'কার্ডটি সঠিকভাবে স্ক্যান করা সম্ভব হয়নি।',
      recommendedAction: 'শিক্ষার্থীকে পুনরায় সোজাভাবে কার্ডটি গেটের সামনে ধরতে বলুন।',
      severity: 'warning',
      technicalDetail: `Server rejection: ${code}.`,
    };
  }
  return {
    code,
    title: 'Gate scan issue',
    explanation: 'The card could not be verified by the school gate.',
    recommendedAction: 'Ask the student to present the badge again clearly.',
    severity: 'warning',
    technicalDetail: `Server rejection: ${code}.`,
  };
}
