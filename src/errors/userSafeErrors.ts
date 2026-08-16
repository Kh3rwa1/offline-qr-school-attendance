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
        title: 'Internet নেই',
        message: 'Internet connection নেই — Attendance এই ফোনে Safe আছে। Internet এলে Auto Send হবে।',
        canRetry: true,
        actionSuggestion: 'Attendance নিতে থাকুন। Internet পেলে Saved Records Auto Send হবে।',
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
        title: 'Camera Permission প্রয়োজন',
        message: 'Student QR Badge Scan করতে Browser-এ Camera Permission প্রয়োজন।',
        canRetry: true,
        actionSuggestion: 'Browser Settings থেকে Camera Allow করুন এবং আবার Try করুন।',
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
        title: 'Session শেষ হয়েছে',
        message: 'Security-র কারণে আপনার Login Session শেষ হয়েছে। দয়া করে আবার Login করুন।',
        canRetry: false,
        actionSuggestion: 'Mobile Number ও Password দিয়ে আবার Login করুন।',
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
        title: 'Access Restricted',
        message: 'এই Action করার Permission নেই। School Headmaster-এর সাথে যোগাযোগ করুন।',
        canRetry: false,
        actionSuggestion: 'Access-এর জন্য School Headmaster বা Admin-এর সাথে যোগাযোগ করুন।',
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
        title: 'Record Already আছে',
        message: 'এই Record বা Badge already System-এ Register করা আছে।',
        canRetry: false,
        actionSuggestion: 'Student ID, Roll Number বা Badge Number Check করুন।',
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
      title: 'Action Complete হয়নি',
      message: 'Action-টি সম্পন্ন করা যায়নি। তবে আপনার Data সম্পূর্ণ Safe আছে।',
      canRetry: true,
      actionSuggestion: 'কিছুক্ষণ পর আবার Try করুন।',
    };
  }
  return {
    title: 'Action Could Not Complete',
    message: 'The requested action could not be completed right now. Your data remains safe.',
    canRetry: true,
    actionSuggestion: 'Please try again in a few moments.',
  };
}
