// Plain-language companion text for Super Admin technical terms and audit
// action codes. Technical terms and codes are never removed from the UI —
// this module only supplies a secondary explanation so a semi-technical
// user (e.g. a district education officer) can understand them without
// asking an engineer. Mirrors the bilingual pattern used by
// rfidRejectionMapper.ts.

export interface PlainExplanation {
  en: string;
  bn: string;
}

export type PlainTermKey =
  | 'rls'
  | 'kms'
  | 'aesCmac'
  | 'rateLimiting'
  | 'envelopeHashing'
  | 'walBackup'
  | 'tenantIsolation'
  | 'tenantIdTooltip'
  | 'udise'
  | 'dpdp'
  | 'multiTenantHub'
  | 'blockPortalSync'
  | 'auditRetention'
  | 'auditTrail'
  | 'nationalPortalSync';

export const PLAIN_TERMS: Record<PlainTermKey, PlainExplanation> = {
  rls: {
    en: "In plain terms: the database itself blocks one school from ever seeing another school's data.",
    bn: 'সহজ ভাষায়: ডেটাবেসই একটি স্কুলকে অন্য স্কুলের তথ্য দেখতে বাধা দেয়।',
  },
  kms: {
    en: 'In plain terms: this is the system that securely creates and stores the secret codes used to protect data.',
    bn: 'সহজ ভাষায়: এটি এমন একটি ব্যবস্থা যা তথ্য সুরক্ষার জন্য গোপন কোড নিরাপদে তৈরি ও সংরক্ষণ করে।',
  },
  aesCmac: {
    en: 'In plain terms: a rotating secret code check that stops copied or reused ID cards and QR codes from working.',
    bn: 'সহজ ভাষায়: এটি একটি পরিবর্তনশীল গোপন কোড যাচাই, যা নকল বা পুনরায় ব্যবহৃত আইডি কার্ড ও কিউআর কোড কাজ করা বন্ধ করে দেয়।',
  },
  rateLimiting: {
    en: 'In plain terms: automatically slows down or blocks a flood of scans in a short time, such as during the morning rush at the school gate.',
    bn: 'সহজ ভাষায়: স্কুল গেটে সকালের ভিড়ের সময় অল্প সময়ে অনেক বেশি স্ক্যান এলে তা স্বয়ংক্রিয়ভাবে ধীর বা বন্ধ করে দেয়।',
  },
  envelopeHashing: {
    en: 'In plain terms: a fingerprint check that stops the same attendance upload from being counted twice.',
    bn: 'সহজ ভাষায়: এটি একটি ফিঙ্গারপ্রিন্ট পরীক্ষা যা একই উপস্থিতি তথ্য দুইবার গণনা হওয়া থেকে আটকায়।',
  },
  walBackup: {
    en: 'In plain terms: every change is continuously and securely backed up, so no data is lost even if a server fails.',
    bn: 'সহজ ভাষায়: প্রতিটি পরিবর্তন ক্রমাগত ও নিরাপদে ব্যাকআপ করা হয়, তাই সার্ভার বিকল হলেও কোনো তথ্য হারায় না।',
  },
  tenantIsolation: {
    en: "In plain terms: each school's data is kept completely separate from every other school's.",
    bn: 'সহজ ভাষায়: প্রতিটি স্কুলের তথ্য অন্য সব স্কুলের থেকে সম্পূর্ণ আলাদা রাখা হয়।',
  },
  tenantIdTooltip: {
    en: "Internal ID used to keep this school's data separate from others. Not needed for daily use.",
    bn: 'এই আইডি স্কুলের তথ্য অন্যদের থেকে আলাদা রাখতে ব্যবহৃত হয়। দৈনন্দিন কাজে এটির প্রয়োজন নেই।',
  },
  udise: {
    en: "In plain terms: the Indian government's official school ID system.",
    bn: 'সহজ ভাষায়: এটি ভারত সরকারের সরকারি স্কুল পরিচিতি ব্যবস্থা।',
  },
  dpdp: {
    en: 'In plain terms: the Indian law that governs how student and staff personal data must be protected.',
    bn: 'সহজ ভাষায়: এটি ভারতীয় আইন যা ছাত্রছাত্রী ও কর্মীদের ব্যক্তিগত তথ্য কীভাবে সুরক্ষিত রাখতে হবে তা নির্ধারণ করে।',
  },
  multiTenantHub: {
    en: 'In plain terms: this dashboard manages every registered school from one place.',
    bn: 'সহজ ভাষায়: এই ড্যাশবোর্ড থেকে নিবন্ধিত সব স্কুল একসাথে পরিচালনা করা যায়।',
  },
  blockPortalSync: {
    en: 'This will upload automatically to the government block education portal.',
    bn: 'এটি স্বয়ংক্রিয়ভাবে সরকারি ব্লক শিক্ষা পোর্টালে আপলোড হয়ে যাবে।',
  },
  auditRetention: {
    en: 'In plain terms: every record is kept for 7 years, as required by Government of India record-keeping rules.',
    bn: 'সহজ ভাষায়: ভারত সরকারের নিয়ম অনুযায়ী প্রতিটি রেকর্ড ৭ বছর সংরক্ষণ করা হয়।',
  },
  auditTrail: {
    en: 'In plain terms: a permanent record of every important action taken on the platform — nothing here can be edited or deleted.',
    bn: 'সহজ ভাষায়: প্ল্যাটফর্মে নেওয়া প্রতিটি গুরুত্বপূর্ণ পদক্ষেপের একটি স্থায়ী রেকর্ড — এখানে কিছু সম্পাদনা বা মুছে ফেলা যায় না।',
  },
  nationalPortalSync: {
    en: 'Changes here sync automatically to the government portal.',
    bn: 'এখানে পরিবর্তন করলে তা স্বয়ংক্রিয়ভাবে সরকারি পোর্টালে আপডেট হয়ে যায়।',
  },
};

export type AuditActionKey =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SCHOOL_PROVISIONED'
  | 'SCHOOL_STATUS_CHANGED'
  | 'MEMBER_INVITED'
  | 'SUSPEND_MEMBERSHIP'
  | 'CARD_ENROLLED'
  | 'READER_STATUS_CHANGED';

// Short plain-language descriptions for raw audit action codes. Used
// alongside (never instead of) the raw code, in both the filter dropdown
// and the audit log table/cards.
export const AUDIT_ACTION_PLAIN: Record<AuditActionKey, string> = {
  USER_LOGIN: 'Someone logged in',
  USER_LOGOUT: 'Someone logged out',
  SCHOOL_PROVISIONED: 'A new school was registered',
  SCHOOL_STATUS_CHANGED: "A school's status was changed (active/suspended/archived)",
  MEMBER_INVITED: 'A staff member was invited to join',
  SUSPEND_MEMBERSHIP: "A staff member's access was stopped",
  CARD_ENROLLED: 'A new ID card/badge was registered',
  READER_STATUS_CHANGED: "A scanner device's status was changed",
};

export const getAuditActionPlainText = (action: string): string =>
  AUDIT_ACTION_PLAIN[action as AuditActionKey] || 'Platform action';
