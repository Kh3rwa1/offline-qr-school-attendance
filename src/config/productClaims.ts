/**
 * AttendEase Centralized Product Claims Registry
 *
 * Single Source of Truth (SSOT) for all approved public marketing and technical assertions.
 * Every claim must have an explicit verification status and evidence trail.
 */

export type ClaimStatus =
  | 'AUTOMATION_VERIFIED'
  | 'INTERNALLY_REVIEWED'
  | 'PILOT_VALIDATED'
  | 'EXTERNALLY_VALIDATED'
  | 'EXTERNALLY_PENDING'
  | 'UNSUPPORTED'
  | 'RETIRED';

export interface ProductClaim {
  id: string;
  category: 'core' | 'hardware' | 'reporting' | 'privacy' | 'telecom' | 'localization' | 'reliability' | 'accessibility';
  status: ClaimStatus;
  approvedPublicCopy: {
    en: string;
    bn: string;
    hi: string;
  };
  prohibitedPhrases: string[];
  evidence: string[];
  lastReviewedAt: string;
  nextReviewAt?: string;
}

export const PRODUCT_CLAIMS: Record<string, ProductClaim> = {
  offlineQrAttendance: {
    id: 'offline-qr-attendance',
    category: 'core',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Teachers can take attendance offline on supported mobile phone cameras. Data saves securely to local storage and syncs when reconnected.',
      bn: 'শিক্ষকরা যেকোনো সমর্থিত মোবাইল ক্যামেরায় অফলাইনে উপস্থিতি নিতে পারেন। তথ্য ডিভাইসে সংরক্ষিত থাকে এবং নেটওয়ার্ক পেলে সিঙ্ক হয়।',
      hi: 'शिक्षक समर्थित मोबाइल कैमरा से ऑफ़लाइन उपस्थिति ले सकते हैं। डेटा डिवाइस में सुरक्षित रहता है और इंटरनेट मिलने पर सिंक होता है।',
    },
    prohibitedPhrases: ['100% fail-proof hardware', 'zero error guarantee'],
    evidence: ['tests/offlineSync.test.ts', 'tests/e2e/offline-scenarios.spec.ts'],
    lastReviewedAt: '2026-08-18',
  },

  zebraFx9600Compatibility: {
    id: 'zebra-fx9600-payload-compatibility',
    category: 'hardware',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Zebra FX9600 IoT Connector webhook JSON tag-read payload specification compatible and verified against documented contracts.',
      bn: 'জেব্রা FX9600 IoT কানেক্টর ওয়েবহুক JSON ফরম্যাটের সাথে সামঞ্জস্যপূর্ণ এবং চুক্তি অনুযায়ী স্বয়ংক্রিয়ভাবে পরীক্ষিত।',
      hi: 'ज़ेब्रा FX9600 IoT कनेक्टर वेबहुक JSON पेलोड प्रारूप के साथ संगत और स्वचालित रूप से सत्यापित है।',
    },
    prohibitedPhrases: ['Zebra certified appliance', 'Officially certified by Zebra Technologies'],
    evidence: ['tests/rfid/zebraHttpEndpoint.test.ts', 'scripts/hardware-runner.ts'],
    lastReviewedAt: '2026-08-18',
  },

  physicalFx9600Commissioning: {
    id: 'physical-fx9600-commissioning',
    category: 'hardware',
    status: 'EXTERNALLY_PENDING',
    approvedPublicCopy: {
      en: 'Physical on-site Zebra FX9600 reader gate commissioning requires on-site RF calibration, doorway tuning, and technician acceptance.',
      bn: 'বাস্তব স্কুল প্রাঙ্গণে Zebra FX9600 রিডার গেট চালুর জন্য অন-সাইট আরএফ ক্যালিব্রেশন এবং টেকনিশিয়ান যাচাইকরণ প্রয়োজন।',
      hi: 'वास्तविक स्कूल परिसर में ज़ेब्रा FX9600 रीडर गेट लगाने के लिए ऑन-साइट आरएफ कैलिब्रेशन और तकनीशियन सत्यापन आवश्यक है।',
    },
    prohibitedPhrases: ['Factory certified on-site', 'Pre-commissioned physical hardware', 'Hardware certified 10/10'],
    evidence: ['docs/hardware/FX9600_COMMISSIONING_TEMPLATE.md', 'docs/audits/EXTERNAL_VALIDATION_REGISTER.md'],
    lastReviewedAt: '2026-08-18',
  },

  udiseOrientedReports: {
    id: 'udise-oriented-reports',
    category: 'reporting',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Internal attendance export formats structured around common UDISE+ and administrative reporting layouts.',
      bn: 'সাধারণ UDISE+ ও প্রশাসনিক রিপোর্টের কাঠামোর সাথে সামঞ্জস্য রেখে অভ্যন্তরীণ উপস্থিতি এক্সপোর্ট ফরম্যাট।',
      hi: 'सामान्य UDISE+ और प्रशासनिक रिपोर्ट संरचना के अनुरूप आंतरिक उपस्थिति निर्यात प्रारूप।',
    },
    prohibitedPhrases: [
      'UDISE+ certified',
      'UDISE+ compliant reports',
      'Government certified reports',
      'Guaranteed portal acceptance',
      'Government approved format',
    ],
    evidence: ['tests/governmentReporting.test.ts', 'src/services/governmentReports/'],
    lastReviewedAt: '2026-08-18',
  },

  governmentAcceptance: {
    id: 'government-acceptance',
    category: 'reporting',
    status: 'EXTERNALLY_PENDING',
    approvedPublicCopy: {
      en: 'Reports are generated for school administrative review. Official department acceptance is determined by authorized education authorities.',
      bn: 'রিপোর্টগুলি বিদ্যালয়ের অভ্যন্তরীণ পর্যালোচনার জন্য প্রস্তুত। সরকারি গ্রহণ যোগ্যতা সংশ্লিষ্ট শিক্ষা কর্তৃপক্ষের সিদ্ধান্তের অধীন।',
      hi: 'रिपोर्ट स्कूल के आंतरिक मूल्यांकन के लिए बनाई जाती हैं। सरकारी स्वीकृति संबंधित शिक्षा प्राधिकरण के निर्णय पर निर्भर है।',
    },
    prohibitedPhrases: [
      'Government approved',
      'Government certified',
      'Govt standard',
      'Approved by Education Department',
      'Official government format',
    ],
    evidence: ['docs/audits/EXTERNAL_VALIDATION_REGISTER.md'],
    lastReviewedAt: '2026-08-18',
  },

  dpdpAlignedPrivacyControls: {
    id: 'dpdp-aligned-privacy-controls',
    category: 'privacy',
    status: 'INTERNALLY_REVIEWED',
    approvedPublicCopy: {
      en: 'Student and staff records protected using DPDP-aligned privacy, access control, encryption, and audit logging practices.',
      bn: 'ভারতের DPDP আইনের মূলনীতির আলোকে তথ্যের গোপনীয়তা, অ্যাক্সেস নিয়ন্ত্রণ ও এনক্রিপশন ব্যবস্থার মাধ্যমে সুরক্ষিত।',
      hi: 'भारत के DPDP सिद्धांतों के अनुसार डेटा गोपनीयता, एक्सेस नियंत्रण और एन्क्रिप्शन द्वारा सुरक्षित।',
    },
    prohibitedPhrases: [
      'DPDP certified',
      'DPDP compliant legal guarantee',
      'Protected under India’s DPDP law guarantee',
      'Officially DPDP compliant',
    ],
    evidence: ['src/app/PrivacyPage.tsx', 'src/services/auditLogService.ts'],
    lastReviewedAt: '2026-08-18',
  },

  smsQueueing: {
    id: 'sms-queueing',
    category: 'telecom',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Transactional absence notification jobs are queued in PostgreSQL upon session finalization.',
      bn: 'উপস্থিতি সেশন সমাপ্ত হলে স্বয়ংক্রিয়ভাবে অনুপস্থিতি এসএমএস পাঠানোর কাজ ডাটাবেসে কিউ হয়।',
      hi: 'उपस्थिति सत्र समाप्त होने पर अनुपस्थिति एसएमएस भेजने का कार्य डेटाबेस में कतारबद्ध होता है।',
    },
    prohibitedPhrases: ['100% instant telecom delivery guarantee'],
    evidence: ['tests/notificationsAndSms.test.ts', 'tests/dltSmsProvider.test.ts'],
    lastReviewedAt: '2026-08-18',
  },

  realTelecomDelivery: {
    id: 'real-telecom-delivery',
    category: 'telecom',
    status: 'EXTERNALLY_PENDING',
    approvedPublicCopy: {
      en: 'Carrier SMS dispatch requires active school DLT principal entity registration and telecom sender credentials.',
      bn: 'অভিভাবকদের এসএমএস পৌঁছানো বিদ্যালয়ের সক্রিয় ডিএলটি নিবন্ধন ও টেলিকম সংযোগের উপর নির্ভরশীল।',
      hi: 'अभिभावकों को एसएमएस डिलीवरी स्कूल के सक्रिय डीएलटी पंजीकरण और टेलीकॉम क्रेडेंशियल पर निर्भर करती है।',
    },
    prohibitedPhrases: ['Free unlimited SMS guaranteed', 'Built-in telecom carrier bypass'],
    evidence: ['docs/audits/EXTERNAL_VALIDATION_REGISTER.md'],
    lastReviewedAt: '2026-08-18',
  },

  englishLocalization: {
    id: 'english-localization',
    category: 'localization',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Comprehensive English language interface across all dashboards, wizard flows, and public pages.',
      bn: 'সমস্ত ড্যাশবোর্ড, উইজার্ড এবং পাবলিক পেজে সম্পূর্ণ ইংরেজি ইন্টারফেস।',
      hi: 'सभी डैशबोर्ड, विज़ार्ड और सार्वजनिक पृष्ठों पर संपूर्ण अंग्रेजी इंटरफ़ेस।',
    },
    prohibitedPhrases: [],
    evidence: ['tests/i18nCompleteness.test.ts'],
    lastReviewedAt: '2026-08-18',
  },

  bengaliLocalization: {
    id: 'bengali-localization',
    category: 'localization',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Authentic Bengali and natural Bengalish terminology across all user-facing teacher and administrative screens.',
      bn: 'শিক্ষক ও প্রশাসনিক সমস্ত ইন্টারফেসে সহজ ও স্বাভাবিক বাংলা পরিভাষা।',
      hi: 'शिक्षक और प्रशासनिक इंटरफ़ेस पर स्पष्ट और स्वाभाविक बंगाली भाषा।',
    },
    prohibitedPhrases: [],
    evidence: ['tests/i18nCompleteness.test.ts', 'tests/e2e/bengali-journeys.spec.ts'],
    lastReviewedAt: '2026-08-18',
  },

  hindiLocalization: {
    id: 'hindi-localization',
    category: 'localization',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Complete authentic Hindi language support for public marketing, onboarding, and platform landing pages.',
      bn: 'পাবলিক পেজ ও পরিচিতি বিভাগে সম্পূর্ণ বিশুদ্ধ হিন্দি ভাষা সমর্থন।',
      hi: 'सार्वजनिक पृष्ठों और ऑनबोर्डिंग विवरणों के लिए संपूर्ण मानक हिंदी भाषा समर्थन।',
    },
    prohibitedPhrases: [],
    evidence: ['src/app/landingCopy.ts', 'tests/landingPageLocalization.test.ts'],
    lastReviewedAt: '2026-08-18',
  },

  encryptedBackups: {
    id: 'encrypted-backups',
    category: 'reliability',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Automated AES-256-CBC encrypted appliance database snapshots with SHA-256 integrity checksum manifests.',
      bn: 'SHA-256 চেকসাম ও AES-256 এনক্রিপশন যুক্ত স্বয়ংক্রিয় ডাটাবেস ব্যাকআপ ব্যবস্থা।',
      hi: 'SHA-256 चेकसम और AES-256 एन्क्रिप्शन के साथ स्वचालित डेटाबेस बैकअप व्यवस्था।',
    },
    prohibitedPhrases: [],
    evidence: ['tests/backupFaultInjection.test.ts', 'scripts/backupAndRestore.sh'],
    lastReviewedAt: '2026-08-18',
  },

  r2Replication: {
    id: 'r2-replication',
    category: 'reliability',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Cloudflare R2 off-site backup replication with SigV4 authentication and integrity validation drill.',
      bn: 'SigV4 প্রমাণীকরণ যুক্ত ক্লাউডফ্লেয়ার R2 দূরবর্তী ব্যাকআপ সংরক্ষণ ব্যবস্থা।',
      hi: 'SigV4 प्रमाणीकरण के साथ क्लाउडफ्लेयर R2 दूरस्थ बैकअप प्रतिकृति प्रणाली।',
    },
    prohibitedPhrases: [],
    evidence: ['tests/cloudflareR2Replication.test.ts', 'scripts/runR2LiveDrill.ts'],
    lastReviewedAt: '2026-08-18',
  },

  accessibilityAutomation: {
    id: 'accessibility-automation',
    category: 'accessibility',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'Automated WCAG 2.2 Level AA rule auditing across all key routes, dialogs, calculators, and navigation.',
      bn: 'প্রধান সমস্ত পেজ ও ডায়ালগে স্বয়ংক্রিয় WCAG 2.2 Level AA মান যাচাই।',
      hi: 'सभी प्रमुख पृष्ठों और संवादों में स्वचालित WCAG 2.2 Level AA मानक परीक्षण।',
    },
    prohibitedPhrases: [
      'WCAG 2.2 AAA officially certified',
      'Third-party accessibility certified',
      'Government accessibility certified',
    ],
    evidence: ['tests/e2e/axe-matrix.spec.ts', 'tests/a11yAndMobileUx.test.tsx'],
    lastReviewedAt: '2026-08-18',
  },

  humanAccessibilityCertification: {
    id: 'human-accessibility-certification',
    category: 'accessibility',
    status: 'EXTERNALLY_PENDING',
    approvedPublicCopy: {
      en: 'Formal assistive technology evaluations with native TalkBack, VoiceOver, and NVDA human users are planned.',
      bn: 'স্ক্রিন রিডার ব্যবহারকারী ব্যক্তিদের মাধ্যমে বাস্তব ব্যবহারযোগ্যতা যাচাইকরণ প্রক্রিয়াধীন।',
      hi: 'स्क्रीन रीडर उपयोगकर्ताओं के साथ वास्तविक उपयोगिता परीक्षण प्रक्रियाधीन है।',
    },
    prohibitedPhrases: ['Officially certified accessible for all disabilities', 'Human verified certified 10/10'],
    evidence: ['docs/audits/ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md'],
    lastReviewedAt: '2026-08-18',
  },

  realSchoolDeployments: {
    id: 'real-school-deployments',
    category: 'core',
    status: 'EXTERNALLY_PENDING',
    approvedPublicCopy: {
      en: 'Pilot deployments in regional schools are planned following initial administrative alignment.',
      bn: 'প্রশাসনিক প্রস্তুতির পর আঞ্চলিক বিদ্যালয়সমূহে পরীক্ষামূলক পাইলট চালুর পরিকল্পনা রয়েছে।',
      hi: 'प्रशासनिक संरेखण के बाद क्षेत्रीय विद्यालयों में प्रायोगिक पायलट शुरू करने की योजना है।',
    },
    prohibitedPhrases: ['Deployed in 500+ schools across WB', 'State-wide standard deployment'],
    evidence: ['docs/audits/EXTERNAL_VALIDATION_REGISTER.md'],
    lastReviewedAt: '2026-08-18',
  },

  customerTestimonials: {
    id: 'customer-testimonials',
    category: 'core',
    status: 'EXTERNALLY_PENDING',
    approvedPublicCopy: {
      en: 'Testimonials will be displayed only when backed by signed school consent and verifiable evidence IDs.',
      bn: 'স্বাক্ষরিত সম্মতিপত্র ও যাচাইযোগ্য প্রমাণ থাকলেই কেবল প্রশংসাপত্র প্রদর্শিত হবে।',
      hi: 'हस्ताक्षरित सहमति और सत्यापन योग्य साक्ष्य होने पर ही प्रशंसापत्र दिखाए जाएंगे।',
    },
    prohibitedPhrases: ['Trusted by 1000+ headmasters', 'Rated 5 stars by all Bengal schools'],
    evidence: ['src/config/approvedTestimonials.ts', 'docs/audits/EXTERNAL_VALIDATION_REGISTER.md'],
    lastReviewedAt: '2026-08-18',
  },

  attendanceSpeed: {
    id: 'attendance-speed',
    category: 'core',
    status: 'AUTOMATION_VERIFIED',
    approvedPublicCopy: {
      en: 'RFID gate attendance processes walk-through badges; mobile QR scanning processes individual cards per teacher camera.',
      bn: 'RFID গেট দিয়ে হাঁটার সময় কার্ড রিড হয়; শিক্ষক নিজস্ব মোবাইল ক্যামেরায় একে একে QR স্ক্যান করেন।',
      hi: 'आरएफआईडी गेट से गुजरते समय कार्ड प्रोसेस होते हैं; शिक्षक अपने मोबाइल कैमरे से व्यक्तिगत क्यूआर स्कैन करते हैं।',
    },
    prohibitedPhrases: [
      'Guaranteed 2-minute attendance for 1000 students on a single phone camera',
      'Zero second instantaneous attendance',
    ],
    evidence: ['tests/onlineAttendance.test.ts', 'tests/rfid/zebraHttpEndpoint.test.ts'],
    lastReviewedAt: '2026-08-18',
  },

  costSavings: {
    id: 'cost-savings',
    category: 'core',
    status: 'INTERNALLY_REVIEWED',
    approvedPublicCopy: {
      en: 'Time and cost comparisons are illustrative estimates based on configurable school operational assumptions.',
      bn: 'সময় ও খরচের তুলনামূলক হিসাব বিদ্যালয়ের কাজের ধরনের ওপর ভিত্তি করে একটি আনুমানিক ধারণা।',
      hi: 'समय और लागत का तुलनात्मक अनुमान स्कूल की कार्यप्रणाली पर आधारित एक सांकेतिक गणना है।',
    },
    prohibitedPhrases: [
      'Guaranteed ₹50,000 cash savings',
      '100% cost reduction guaranteed',
      'Verified actual financial audit savings',
    ],
    evidence: ['src/app/landingAssumptions.ts'],
    lastReviewedAt: '2026-08-18',
  },
};
