import { Language } from '../i18n';

export interface UserSafeError {
  title: string;
  message: string;
  canRetry: boolean;
  actionSuggestion: string;
}

export function getUserSafeError(error: any, lang: Language = 'en'): UserSafeError {
  const msg = typeof error === 'string' ? error : error?.message || error?.error || '';
  const lower = msg.toLowerCase();

  // 1. Network / Offline / Connection Failures
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('offline') ||
    lower.includes('load failed') ||
    lower.includes('connection refused') ||
    lower.includes('internet')
  ) {
    if (lang === 'bn') {
      return {
        title: 'ইন্টারনেট সংযোগ নেই',
        message: 'ইন্টারনেট সংযোগ বন্ধ রয়েছে। আপনার উপস্থিতি ডিভাইসে সুরক্ষিত আছে এবং পরে স্বয়ংক্রিয়ভাবে জমা হবে।',
        canRetry: true,
        actionSuggestion: 'ইন্টারনেট সংযোগ পুনরায় চালু হলে স্বয়ংক্রিয়ভাবে জমা হবে।',
      };
    }
    return {
      title: 'Internet Unavailable',
      message: 'Internet connection is unavailable. Attendance records are saved safely on this device and will sync automatically when back online.',
      canRetry: true,
      actionSuggestion: 'Continue taking attendance offline. Records will sync when connection returns.',
    };
  }

  // 2. Camera Permissions & Media Access
  if (
    lower.includes('camera') ||
    lower.includes('notallowederror') ||
    lower.includes('permission denied') ||
    lower.includes('notreadableerror')
  ) {
    if (lang === 'bn') {
      return {
        title: 'ক্যামেরা ব্যবহারের অনুমতি প্রয়োজন',
        message: 'কিউআর ব্যাজ স্ক্যান করতে ব্রাউজারে ক্যামেরার অনুমতি দেওয়া প্রয়োজন।',
        canRetry: true,
        actionSuggestion: 'ব্রাউজারের সেটিংস থেকে ক্যামেরা ব্যবহারের অনুমতি দিন।',
      };
    }
    return {
      title: 'Camera Permission Needed',
      message: 'Camera access is required to scan student QR badges.',
      canRetry: true,
      actionSuggestion: 'Allow camera access in your browser site settings and retry.',
    };
  }

  // 3. Unauthorized / Session Expired
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('session expired')) {
    if (lang === 'bn') {
      return {
        title: 'সেশনের মেয়াদ শেষ হয়েছে',
        message: 'নিরাপত্তার স্বার্থে আপনার সেশন বন্ধ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।',
        canRetry: false,
        actionSuggestion: 'পুনরায় লগইন করতে লগইন পৃষ্ঠায় ফিরে যান।',
      };
    }
    return {
      title: 'Session Expired',
      message: 'Your authenticated login session has expired.',
      canRetry: false,
      actionSuggestion: 'Please sign in again with your mobile number and password.',
    };
  }

  // 4. Forbidden / Access Denied
  if (lower.includes('forbidden') || lower.includes('403') || lower.includes('access denied')) {
    if (lang === 'bn') {
      return {
        title: 'অ্যাক্সেস সংরক্ষিত',
        message: 'এই কাজটি করার জন্য আপনার অনুমতি নেই। প্রধান শিক্ষকের সাথে যোগাযোগ করুন।',
        canRetry: false,
        actionSuggestion: 'অনুমোদনের জন্য বিদ্যালয় প্রধানের সাথে যোগাযোগ করুন।',
      };
    }
    return {
      title: 'Access Restricted',
      message: 'You do not have administrative permission to perform this action.',
      canRetry: false,
      actionSuggestion: 'Contact your school Headmaster or administrator for access.',
    };
  }

  // 5. Duplicate / Conflict
  if (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('conflict') || lower.includes('409')) {
    if (lang === 'bn') {
      return {
        title: 'রেকর্ড ইতিমধ্যে বিদ্যমান',
        message: 'এই তথ্যটি ইতিমধ্যে সিস্টেমে নথিভুক্ত রয়েছে।',
        canRetry: false,
        actionSuggestion: 'নথিভুক্ত তথ্যটি পরীক্ষা করে দেখুন।',
      };
    }
    return {
      title: 'Record Already Exists',
      message: 'A matching record or badge is already registered in the system.',
      canRetry: false,
      actionSuggestion: 'Verify the student ID, roll number, or badge number.',
    };
  }

  // Generic fallback
  if (lang === 'bn') {
    return {
      title: 'একটি সমস্যা দেখা দিয়েছে',
      message: 'অনুরোধটি সম্পন্ন করা সম্ভব হয়নি। আপনার সংরক্ষিত তথ্য অক্ষত আছে।',
      canRetry: true,
      actionSuggestion: 'অনুগ্রহ করে কয়েক মুহূর্ত পর পুনরায় চেষ্টা করুন।',
    };
  }
  return {
    title: 'Action Could Not Complete',
    message: 'The requested action could not be completed right now. Your data remains safe.',
    canRetry: true,
    actionSuggestion: 'Please try again in a few moments.',
  };
}
