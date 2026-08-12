export type Language = 'en' | 'bn';

export const translations = {
  en: {
    appName: 'Offline QR School Attendance',
    schoolSystem: 'West Bengal Government School System',
    login: 'Log In',
    logout: 'Log Out',
    phoneNumber: 'Phone Number',
    password: 'Password',
    selectSchool: 'Select School',
    roleSuperAdmin: 'Super Administrator',
    roleSchoolAdmin: 'School Administrator',
    roleTeacher: 'Teacher',
    roleReportViewer: 'Report Viewer',
    authFailed: 'Invalid phone number or password.',
    sessionExpired: 'Your session has expired. Please log in again.',
    suspendedAccount: 'Your account or school membership is currently suspended.',
    unauthorized: 'You are not authorized to perform this action.',
    crossTenantDenied: 'Access denied: Cannot access resources belonging to another school.',
    deviceRevoked: 'Your device registration has been revoked.',
    syncSuccess: 'Synchronization completed successfully.',
    syncOffline: 'Device is offline. Changes saved locally in IndexedDB outbox.',
    submit: 'Submit',
    cancel: 'Cancel',
    save: 'Save',
  },
  bn: {
    appName: 'অফলাইন কিউআর স্কুল উপস্থিতি',
    schoolSystem: 'পশ্চিমবঙ্গ সরকার বিদ্যালয় ব্যবস্থাপনা',
    login: 'লগ ইন করুন',
    logout: 'লগ আউট করুন',
    phoneNumber: 'ফোন নম্বর',
    password: 'পাসওয়ার্ড',
    selectSchool: 'বিদ্যালয় নির্বাচন করুন',
    roleSuperAdmin: 'সুপার অ্যাডমিনিস্ট্রেটর',
    roleSchoolAdmin: 'বিদ্যালয় প্রধান / অ্যাডমিন',
    roleTeacher: 'শিক্ষক / শিক্ষিকা',
    roleReportViewer: 'রিপোর্ট দর্শক',
    authFailed: 'ভুল ফোন নম্বর বা পাসওয়ার্ড।',
    sessionExpired: 'আপনার সেশনের মেয়াদ শেষ হয়ে গেছে। পুনরায় লগইন করুন।',
    suspendedAccount: 'আপনার অ্যাকাউন্ট বা বিদ্যালয় সদস্যপদ স্থগিত রয়েছে।',
    unauthorized: 'আপনার এই কাজ করার অনুমতি নেই।',
    crossTenantDenied: 'প্রবেশাধিকার প্রত্যাখ্যাত: অন্য বিদ্যালয়ের তথ্য দেখা নিষেধ।',
    deviceRevoked: 'আপনার ডিভাইস রেজিস্ট্রেশন বাতিল করা হয়েছে।',
    syncSuccess: 'সিঙ্ক সফলভাবে সম্পন্ন হয়েছে।',
    syncOffline: 'ডিভাইসটি অফলাইনে আছে। পরিবর্তনগুলি লোকাল আউটবক্সে সংরক্ষিত হয়েছে।',
    submit: 'জমা দিন',
    cancel: 'বাতিল',
    save: 'সংরক্ষণ করুন',
  },
};

export function translate(key: keyof typeof translations.en, lang: Language = 'en'): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || key;
}
