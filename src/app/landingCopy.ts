// All landing page copy in English + বাংলা so any visitor understands the page
// in under 5 seconds, in either language, using the header toggle.
export type LocalizedText = { en: string; bn: string };
export const L = (en: string, bn: string): LocalizedText => ({ en, bn });

export const LANDING_COPY = {
  navHowItWorks: L('How it works', 'কীভাবে কাজ করে'),
  navGettingStarted: L('Getting started', 'শুরু করার ধাপ'),
  navSavings: L('Savings', 'সাশ্রয়ের হিসাব'),
  navContact: L('Contact', 'যোগাযোগ'),
  signIn: L('School Sign In', 'স্কুল লগইন'),
  bookDemo: L('Book a Free Demo', 'ফ্রি ডেমো বুক করুন'),
  langLabel: L('Language', 'ভাষা'),

  heroBadge: L('Offline-first school attendance', 'অফলাইন-ফার্স্ট স্কুল হাজিরা'),
  heroTitle1: L('Morning attendance in under 2 minutes.', 'মাত্র ২ মিনিটে সকালের হাজিরা।'),
  heroTitle2: L('Even with no internet.', 'ইন্টারনেট ছাড়াও চলে।'),
  heroSubtitle: L(
    'Students walk through the gate, or teachers scan a card with any phone camera. Records save safely on the device and sync automatically when internet returns. UDISE+ reports are ready for you.',
    'শিক্ষার্থীরা গেট দিয়ে ঢুকলেই হাজিরা হয়, অথবা শিক্ষক যেকোনো ফোনের ক্যামেরায় কার্ড স্ক্যান করেন। তথ্য নিরাপদে ডিভাইসে জমা থাকে, ইন্টারনেট ফিরলে নিজে থেকেই পাঠানো হয়। UDISE+ রিপোর্ট তৈরি থেকে যায়।'
  ),
  pillSetup: L('90-second setup', '৯০ সেকেন্ডে সেটআপ'),
  pillOffline: L('Works offline', 'অফলাইনে চলে'),
  pillSms: L('Parent SMS alerts', 'অভিভাবকদের এসএমএস'),
  pillUdise: L('UDISE+ ready', 'UDISE+ প্রস্তুত'),

  capOffline: L('Works 100% offline', '১০০% অফলাইনে চলে'),
  capRfid: L('Walk-in RFID gate ready', 'ওয়াক-ইন RFID গেট প্রস্তুত'),
  capUdise: L('UDISE+ format reports', 'UDISE+ ফরম্যাট রিপোর্ট'),
  capSms: L('Parent SMS alerts', 'অভিভাবকদের এসএমএস'),
  capBilingual: L('বাংলা + English', 'বাংলা + English'),
  capExcel: L('Excel student import', 'এক্সেল থেকে ছাত্র যুক্ত'),

  howKicker: L('How it works', 'কীভাবে কাজ করে'),
  howTitle: L('Take attendance in two simple ways', 'মাত্র দুটি সহজ ধাপে উপস্থিতি'),
  howCard1Title: L('Scan a card — about 1 second', 'কার্ড স্ক্যান — মাত্র ১ সেকেন্ড'),
  howCard1Desc: L(
    'Teachers scan each student’s card with any phone camera, or students simply walk through the RFID gate. It works in classrooms with no internet at all.',
    'শিক্ষক যেকোনো ফোনের ক্যামেরায় ছাত্রের কার্ড স্ক্যান করেন, অথবা ছাত্ররা RFID গেট দিয়ে ঢুকে যায়। একেবারে ইন্টারনেট ছাড়া ক্লাসেও কাজ করে।'
  ),
  howCard1Cta: L('Try a demo scan', 'ডেমো স্ক্যান দেখুন'),
  howCard1Scanning: L('Scanning…', 'স্ক্যান হচ্ছে…'),
  simVerified: L('Marked present', 'উপস্থিত ধরা হয়েছে'),
  simInstant: L('Checked instantly', 'মুহূর্তেই যাচাই সম্পন্ন'),
  simNote: L('Simulated example — no real student data', 'শুধুমাত্র উদাহরণ — কোনো আসল ছাত্রের তথ্য নেই'),
  howCard2Title: L('Everything syncs itself', 'সব তথ্য নিজে থেকেই সিঙ্ক হয়'),
  howCard2Desc: L(
    'When the phone finds internet again, saved attendance uploads automatically. Reports are ready to download for block and district offices.',
    'ফোনে আবার ইন্টারনেট এলে জমানো উপস্থিতি স্বয়ংক্রিয়ভাবে আপলোড হয়। ব্লক ও জেলা অফিসের জন্য রিপোর্ট ডাউনলোডের জন্য তৈরি থাকে।'
  ),
  howCard2Cta: L('Sign in to your school', 'আপনার বিদ্যালয়ে লগইন করুন'),

  startKicker: L('Getting started', 'শুরু করার ধাপ'),
  startTitle: L('From first call to first morning — 8 clear steps', 'প্রথম কল থেকে প্রথম সকাল — মাত্র ৮টি সহজ ধাপ'),
  startBoxLabel: L('What your school gets', 'আপনার বিদ্যালয় যা পাবে'),
  startPromise: L('A roll call that took 15 minutes now takes under 2', 'যে হাজিরায় লাগত ১৫ মিনিট, এখন লাগে ২ মিনিটেরও কম'),
  startDeliverable: L('You get', 'আপনি পাবেন'),
  stepWord: L('Step', 'ধাপ'),

  featTitle: L('Built for real classrooms', 'আসল ক্লাসরুমের জন্য তৈরি'),
  featSubtitle: L(
    'Made for the daily reality of your school — power cuts, weak network, busy mornings.',
    'বিদ্যুৎ বিভ্রাট, দুর্বল নেটওয়ার্ক, ব্যস্ত সকাল — আপনার বিদ্যালয়ের প্রতিদিনের বাস্তবতা মাথায় রেখে তৈরি।'
  ),
  feat1Title: L('Any phone works', 'যেকোনো ফোনেই চলে'),
  feat1Desc: L('Teachers use the phone they already have. No costly machines to buy or maintain.', 'শিক্ষকরা নিজেদের ফোনই ব্যবহার করেন। দামি যন্ত্র কেনা বা রক্ষণাবেক্ষণের দরকার নেই।'),
  feat2Title: L('No internet? No problem.', 'ইন্টারনেট নেই? সমস্যা নেই।'),
  feat2Desc: L('Attendance saves safely on the phone and uploads itself when the network comes back.', 'উপস্থিতি ফোনে নিরাপদে জমা থাকে এবং নেটওয়ার্ক ফিরলে নিজে থেকেই পাঠানো হয়।'),
  feat3Title: L('Government-ready reports', 'সরকারি ফরম্যাটে রিপোর্ট'),
  feat3Desc: L(
    'UDISE+ format exports for block and district offices, with student data protected under India’s DPDP law.',
    'ব্লক ও জেলা অফিসের জন্য UDISE+ ফরম্যাট রিপোর্ট, সঙ্গে ভারতের DPDP আইন অনুযায়ী ছাত্রদের তথ্য সুরক্ষা।'
  ),

  roiKicker: L('Savings calculator', 'সাশ্রয়ের হিসাব'),
  roiTitle: L('See how much time your school saves', 'আপনার বিদ্যালয় কতটা সময় বাঁচবে দেখুন'),
  roiSliderLabel: L('Number of students in your school', 'আপনার বিদ্যালয়ের শিক্ষার্থী সংখ্যা'),
  roiStudents: L('students', 'শিক্ষার্থী'),
  roiHoursLabel: L('Teacher hours saved', 'শিক্ষকদের সময় সাশ্রয়'),
  roiPaperLabel: L('Register pages saved', 'খাতার পাতার সাশ্রয়'),
  roiPerYear: L('per year', 'প্রতি বছর'),
  roiPoint1: L('Morning roll call finished in under 2 minutes', 'সকালের হাজিরা শেষ মাত্র ২ মিনিটে'),
  roiPoint2: L('Every attendance record automatically backed up', 'প্রতিটি উপস্থিতির স্বয়ংক্রিয় ব্যাকআপ'),
  roiNote: L(
    'How we estimate: about 5 seconds saved per student per day across 220 school days, and roughly one paper register page per student per week.',
    'কীভাবে হিসাব করি: প্রতি ছাত্র প্রতিদিন প্রায় ৫ সেকেন্ড সাশ্রয় (বছরে ২২০টি স্কুল দিবস) এবং প্রতি ছাত্র প্রতি সপ্তাহে প্রায় ১ পাতা খাতা সাশ্রয়।'
  ),

  ctaKicker: L('Next step', 'পরবর্তী ধাপ'),
  ctaTitle: L('Bring 2-minute attendance to your school', 'আপনার বিদ্যালয়ে আনুন ২ মিনিটের হাজিরা'),
  ctaSubtitle: L(
    'Book a free 15-minute demo — we show everything on your own phone. No commitment needed.',
    'ফ্রি ১৫ মিনিটের ডেমো বুক করুন — আপনার নিজের ফোনেই সব দেখিয়ে দেব। কোনো বাধ্যবাধকতা নেই।'
  ),
  ctaContact: L('Questions? Write to us', 'কোনো প্রশ্ন? আমাদের লিখুন'),

  footerCompliance: L('Student data protected under India’s DPDP Act. UDISE+ format supported.', 'ভারতের DPDP আইন অনুযায়ী ছাত্রদের তথ্য সুরক্ষিত। UDISE+ ফরম্যাট সমর্থিত।'),
  footerPrivacy: L('Privacy Policy', 'গোপনীয়তা নীতি'),
  footerTerms: L('Terms of Use', 'ব্যবহারের শর্তাবলী'),
  footerContact: L('Contact', 'যোগাযোগ'),

  demoTitle: L('Book a free school demo', 'ফ্রি স্কুল ডেমো বুক করুন'),
  demoDesc: L('We will call you within 4 working hours to schedule a 15-minute demo on your own phone.', 'আপনার নিজের ফোনে ১৫ মিনিটের ডেমোর সময় ঠিক করতে ৪ কর্মঘণ্টার মধ্যে আমরা আপনাকে কল করব।'),
  demoName: L('Your full name', 'আপনার পুরো নাম'),
  demoPhone: L('Mobile number', 'মোবাইল নম্বর'),
  demoEmail: L('Email (optional)', 'ইমেল (ঐচ্ছিক)'),
  demoSchool: L('School name', 'বিদ্যালয়ের নাম'),
  demoDistrict: L('District', 'জেলা'),
  demoStudents: L('Number of students', 'শিক্ষার্থীর সংখ্যা'),
  demoSubmit: L('Request Demo', 'ডেমোর অনুরোধ করুন'),
  demoCancel: L('Cancel', 'বাতিল'),
  demoSuccessTitle: L('Demo request received!', 'ডেমোর অনুরোধ পৌঁছেছে!'),
  demoSuccessBody: L('Thank you! We will call you within 4 working hours to fix a time.', 'ধন্যবাদ! সময় ঠিক করতে ৪ কর্মঘণ্টার মধ্যে আমরা আপনাকে কল করব।'),
  demoDone: L('Done', 'ঠিক আছে'),
  demoError: L('Could not send the request. Please check the details and try again.', 'অনুরোধ পাঠানো যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।'),
  demoNetworkError: L('No internet connection. Please try again when you are back online.', 'ইন্টারনেট সংযোগ নেই। অনলাইনে এলে আবার চেষ্টা করুন।'),
};

export interface OnboardingStage {
  step: number;
  key: string;
  name: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  deliverable: LocalizedText;
  image: string;
  badge: LocalizedText;
  tag: LocalizedText;
}

export const ONBOARDING_STAGES: OnboardingStage[] = [
  {
    step: 1,
    key: 'discover',
    name: L('1. See it', '১. দেখুন'),
    title: L('See how it works', 'কীভাবে কাজ করে দেখুন'),
    subtitle: L('We show you how one card scan takes about a second — on any phone, with no internet.', 'কীভাবে মাত্র এক সেকেন্ডে একটি কার্ড স্ক্যান হয় — যেকোনো ফোনে, ইন্টারনেট ছাড়াই — আমরা আপনাকে দেখিয়ে দেব।'),
    deliverable: L('A clear picture of the system', 'সিস্টেম সম্পর্কে স্পষ্ট ধারণা'),
    image: '/assets/steps/step-1.jpg',
    badge: L('1-second scan', '১ সেকেন্ডের স্ক্যান'),
    tag: L('Classroom ready', 'ক্লাসের জন্য প্রস্তুত'),
  },
  {
    step: 2,
    key: 'compliance',
    name: L('2. Check the rules', '২. নিয়ম যাচাই'),
    title: L('Check compliance & privacy', 'নিয়ম ও গোপনীয়তা যাচাই'),
    subtitle: L('See UDISE+ format reports and how student data stays protected under India’s DPDP law.', 'UDISE+ ফরম্যাটের রিপোর্ট দেখুন এবং ভারতের DPDP আইন অনুযায়ী ছাত্রদের তথ্য কীভাবে সুরক্ষিত থাকে তা জানুন।'),
    deliverable: L('Compliance checklist', 'কমপ্লায়েন্স তালিকা'),
    image: '/assets/steps/step-2.jpg',
    badge: L('UDISE+ format', 'UDISE+ ফরম্যাট'),
    tag: L('Govt standard', 'সরকারি মান'),
  },
  {
    step: 3,
    key: 'demo',
    name: L('3. Try it live', '৩. ডেমো নিন'),
    title: L('Hands-on demo for your staff', 'আপনার কর্মীদের জন্য হাতে-কলমে ডেমো'),
    subtitle: L('A free 15-minute live trial where your headmaster and teachers test attendance themselves.', 'ফ্রি ১৫ মিনিটের লাইভ ট্রায়াল, যেখানে আপনার প্রধান শিক্ষক ও শিক্ষকরা নিজেরাই উপস্থিতি পরীক্ষা করবেন।'),
    deliverable: L('Free trial workspace', 'ফ্রি ট্রায়াল ওয়ার্কস্পেস'),
    image: '/assets/steps/step-3.jpg',
    badge: L('Free trial', 'ফ্রি ট্রায়াল'),
    tag: L('Staff walkthrough', 'কর্মীদের পরিচিতি'),
  },
  {
    step: 4,
    key: 'agreement',
    name: L('4. Simple agreement', '৪. সহজ চুক্তি'),
    title: L('A simple, fair agreement', 'সহজ ও ন্যায্য চুক্তি'),
    subtitle: L('A straightforward school agreement. Your school owns 100% of its data — no lock-in.', 'একটি সহজ বিদ্যালয় চুক্তি। আপনার তথ্যের ১০০% মালিকানা আপনার বিদ্যালয়ের — কোনো লক-ইন নেই।'),
    deliverable: L('Signed agreement', 'স্বাক্ষরিত চুক্তিপত্র'),
    image: '/assets/steps/step-4.jpg',
    badge: L('You own your data', 'তথ্যের মালিক আপনি'),
    tag: L('Fair terms', 'ন্যায্য শর্ত'),
  },
  {
    step: 5,
    key: 'setup',
    name: L('5. School setup', '৫. স্কুল সেটআপ'),
    title: L('We set up your school portal', 'আমরা আপনার স্কুল পোর্টাল তৈরি করি'),
    subtitle: L('Your school gets its own secure page and admin login — completely separate from every other school.', 'আপনার বিদ্যালয় নিজস্ব সুরক্ষিত পেজ ও অ্যাডমিন লগইন পায় — অন্য সব বিদ্যালয় থেকে সম্পূর্ণ আলাদা।'),
    deliverable: L('School portal & admin login', 'স্কুল পোর্টাল ও অ্যাডমিন লগইন'),
    image: '/assets/steps/step-5.jpg',
    badge: L('Private school page', 'নিজস্ব স্কুল পেজ'),
    tag: L('Secure link', 'নিরাপদ লিংক'),
  },
  {
    step: 6,
    key: 'students',
    name: L('6. Add students', '৬. ছাত্র যুক্ত'),
    title: L('Import your student list', 'ছাত্রতালিকা যুক্ত করুন'),
    subtitle: L('Upload your existing Excel sheet — hundreds of students are added at once and ID cards are generated automatically.', 'আপনার বিদ্যমান এক্সেল ফাইল আপলোড করুন — একসাথে শত শত ছাত্র যুক্ত হয় এবং আইডি কার্ড নিজে থেকেই তৈরি হয়।'),
    deliverable: L('Student list ready', 'ছাত্রতালিকা প্রস্তুত'),
    image: '/assets/steps/step-6.jpg',
    badge: L('Excel upload', 'এক্সেল আপলোড'),
    tag: L('Auto ID cards', 'স্বয়ংক্রিয় কার্ড'),
  },
  {
    step: 7,
    key: 'training',
    name: L('7. Train teachers', '৭. শিক্ষক প্রশিক্ষণ'),
    title: L('5-minute teacher training', '৫ মিনিটের শিক্ষক প্রশিক্ষণ'),
    subtitle: L('So simple that any teacher learns it in 5 minutes on their own phone.', 'এতই সহজ যে যেকোনো শিক্ষক নিজের ফোনে মাত্র ৫ মিনিটে শিখে যান।'),
    deliverable: L('Teacher quick-start cards', 'শিক্ষকদের গাইড কার্ড'),
    image: '/assets/steps/step-7.jpg',
    badge: L('5-minute training', '৫ মিনিটের প্রশিক্ষণ'),
    tag: L('Easy for teachers', 'শিক্ষকদের জন্য সহজ'),
  },
  {
    step: 8,
    key: 'live',
    name: L('8. Go live', '৮. চালু করুন'),
    title: L('Your first morning', 'আপনার প্রথম সকাল'),
    subtitle: L('Gate and classroom attendance run together from day one — with automatic parent SMS alerts.', 'প্রথম দিন থেকেই গেট ও ক্লাসের উপস্থিতি একসাথে চলে — সঙ্গে স্বয়ংক্রিয় অভিভাবক এসএমএস।'),
    deliverable: L('Fully running school', 'সম্পূর্ণ চালু ব্যবস্থা'),
    image: '/assets/steps/step-8.jpg',
    badge: L('Gate + class live', 'গেট + ক্লাস চালু'),
    tag: L('Real results', 'প্রকৃত ফলাফল'),
  },
];
