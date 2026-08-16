// All landing page copy in English + বাংলা + हिन्दी (Hinglish) so any visitor
// understands the page in under 5 seconds using the header language toggle.
export type LocalizedText = { en: string; bn: string; hi: string };
export const L = (en: string, bn: string, hi: string): LocalizedText => ({ en, bn, hi });

export const LANDING_COPY = {
  navHowItWorks: L('How it works', 'কীভাবে কাজ করে', 'कैसे काम करता है'),
  navGettingStarted: L('Getting started', 'শুরু করার ধাপ', 'शुरुआत के Steps'),
  navSavings: L('Savings', 'সাশ্রয়ের হিসাব', 'Saving Calculator'),
  navContact: L('Contact', 'যোগাযোগ', 'Contact'),
  signIn: L('School Sign In', 'স্কুল লগইন', 'School Login'),
  bookDemo: L('Book a Free Demo', 'ফ্রি ডেমো বুক করুন', 'Free Demo Book करें'),
  langLabel: L('Language', 'ভাষা', 'Language'),

  heroBadge: L('Offline-first school attendance', 'অফলাইন-ফার্স্ট স্কুল হাজিরা', 'Offline-first school attendance'),
  heroTitle1: L('Morning attendance in under 2 minutes.', 'মাত্র ২ মিনিটে সকালের হাজিরা।', 'सिर्फ 2 मिनट में सुबह की Attendance।'),
  heroTitle2: L('Even with no internet.', 'ইন্টারনেট ছাড়াও চলে।', 'Internet के बिना भी।'),
  heroSubtitle: L(
    'Students walk through the gate, or teachers scan a card with any phone camera. Records save safely on the device and sync automatically when internet returns. UDISE+ reports are ready for you.',
    'শিক্ষার্থীরা গেট দিয়ে ঢুকলেই হাজিরা হয়, অথবা শিক্ষক যেকোনো ফোনের ক্যামেরায় কার্ড স্ক্যান করেন। তথ্য নিরাপদে ডিভাইসে জমা থাকে, ইন্টারনেট ফিরলে নিজে থেকেই পাঠানো হয়। UDISE+ রিপোর্ট তৈরি থেকে যায়।',
    'Students gate से enter करते हैं, या teachers किसी भी phone camera से card scan करते हैं। Records device पर Safe save होते हैं और Internet आते ही automatically sync हो जाते हैं। UDISE+ reports तैयार रहती हैं।'
  ),
  pillSetup: L('90-second setup', '৯০ সেকেন্ডে সেটআপ', '90-second setup'),
  pillOffline: L('Works offline', 'অফলাইনে চলে', 'Offline चलता है'),
  pillSms: L('Parent SMS alerts', 'অভিভাবকদের এসএমএস', 'Parents को SMS alerts'),
  pillUdise: L('UDISE+ ready', 'UDISE+ প্রস্তুত', 'UDISE+ ready'),

  capOffline: L('Works 100% offline', '১০০% অফলাইনে চলে', '100% offline चलता है'),
  capRfid: L('Walk-in RFID gate ready', 'ওয়াক-ইন RFID গেট প্রস্তুত', 'Walk-in RFID gate ready'),
  capUdise: L('UDISE+ format reports', 'UDISE+ ফরম্যাট রিপোর্ট', 'UDISE+ format reports'),
  capSms: L('Parent SMS alerts', 'অভিভাবকদের এসএমএস', 'Parents को SMS alerts'),
  capBilingual: L('বাংলা + English + हिन्दी', 'বাংলা + English + हिन्दी', 'বাংলা + English + हिन्दी'),
  capExcel: L('Excel student import', 'এক্সেল থেকে ছাত্র যুক্ত', 'Excel से student import'),

  howKicker: L('How it works', 'কীভাবে কাজ করে', 'कैसे काम करता है'),
  howTitle: L('Take attendance in two simple ways', 'মাত্র দুটি সহজ ধাপে উপস্থিতি', 'सिर्फ दो आसान तरीकों से attendance लें'),
  howCard1Title: L('Scan a card — about 1 second', 'কার্ড স্ক্যান — মাত্র ১ সেকেন্ড', 'Card scan — सिर्फ 1 second'),
  howCard1Desc: L(
    'Teachers scan each student’s card with any phone camera, or students simply walk through the RFID gate. It works in classrooms with no internet at all.',
    'শিক্ষক যেকোনো ফোনের ক্যামেরায় ছাত্রের কার্ড স্ক্যান করেন, অথবা ছাত্ররা RFID গেট দিয়ে ঢুকে যায়। একেবারে ইন্টারনেট ছাড়া ক্লাসেও কাজ করে।',
    'Teachers किसी भी phone camera से student का card scan करते हैं, या students RFID gate से walk through करते हैं। बिना internet के classroom में भी काम करता है।'
  ),
  howCard1Cta: L('Try a demo scan', 'ডেমো স্ক্যান দেখুন', 'Demo scan देखें'),
  howCard1Scanning: L('Scanning…', 'স্ক্যান হচ্ছে…', 'Scan हो रहा है…'),
  simVerified: L('Marked present', 'উপস্থিত ধরা হয়েছে', 'Present mark हुआ'),
  simInstant: L('Checked instantly', 'মুहূর্তেই যাচাই সম্পন্ন', 'तुरंत verify हुआ'),
  simNote: L('Simulated example — no real student data', 'শুধুমাত্র উদাহরণ — কোনো আসল ছাত্রের তথ্য নেই', 'सिर्फ example — कोई real student data नहीं'),
  howCard2Title: L('Everything syncs itself', 'সব তথ্য নিজে থেকেই সিঙ্ক হয়', 'सब कुछ खुद sync होता है'),
  howCard2Desc: L(
    'When the phone finds internet again, saved attendance uploads automatically. Reports are ready to download for block and district offices.',
    'ফোনে আবার ইন্টারনেট এলে জমানো উপস্থিতি স্বয়ংক্রিয়ভাবে আপলোড হয়। ব্লক ও জেলা অফিসের জন্য রিপোর্ট ডাউনলোডের জন্য তৈরি থাকে।',
    'Phone में internet आते ही saved attendance automatically upload हो जाती है। Block और district offices के लिए reports download के लिए तैयार रहती हैं।'
  ),
  howCard2Cta: L('Sign in to your school', 'আপনার বিদ্যালয়ে লগইন করুন', 'अपने School में Login करें'),

  startKicker: L('Getting started', 'শুরু করার ধাপ', 'शुरुआत के Steps'),
  startTitle: L('From first call to first morning — 8 clear steps', 'প্রথম কল থেকে প্রথম সকাল — মাত্র ৮টি সহজ ধাপ', 'पहली call से पहली सुबह तक — सिर्फ 8 आसान steps'),
  startBoxLabel: L('What your school gets', 'আপনার বিদ্যালয় যা পাবে', 'आपके school को क्या मिलता है'),
  startPromise: L('A roll call that took 15 minutes now takes under 2', 'যে হাজিরায় লাগত ১৫ মিনিট, এখন লাগে ২ মিনিটেরও কম', 'जो roll call में 15 minutes लगते थे, अब 2 minutes से कम'),
  startDeliverable: L('You get', 'আপনি পাবেন', 'आपको मिलेगा'),
  stepWord: L('Step', 'ধাপ', 'Step'),

  featTitle: L('Built for real classrooms', 'আসল ক্লাসরুমের জন্য তৈরি', 'असली classrooms के लिए बनाया गया'),
  featSubtitle: L(
    'Made for the daily reality of your school — power cuts, weak network, busy mornings.',
    'বিদ্যুৎ বিভ্রাট, দুর্বল নেটওয়ার্ক, ব্যস্ত সকাল — আপনার বিদ্যালয়ের প্রতিদিনের বাস্তবতা মাথায় রেখে তৈরি।',
    'Power cuts, weak network, busy mornings — आपके school की daily reality को ध्यान में रखकर बनाया गया।'
  ),
  feat1Title: L('Any phone works', 'যেকোনো ফোনেই চলে', 'कोई भी phone चलता है'),
  feat1Desc: L('Teachers use the phone they already have. No costly machines to buy or maintain.', 'শিক্ষকরা নিজেদের ফোনই ব্যবহার করেন। দামি যন্ত্র কেনা বা রক্ষণাবেক্ষণের দরকার নেই।', 'Teachers अपना मौजूदा phone use करते हैं। महंगी machines खरीदने की जरूरत नहीं।'),
  feat2Title: L('No internet? No problem.', 'ইন্টারনেট নেই? সমস্যা নেই।', 'Internet नहीं? कोई problem नहीं।'),
  feat2Desc: L('Attendance saves safely on the phone and uploads itself when the network comes back.', 'উপস্থিতি ফোনে নিরাপদে জমা থাকে এবং নেটওয়ার্ক ফিরলে নিজে থেকেই পাঠানো হয়।', 'Attendance phone पर safe save होती है और network वापस आते ही खुद upload हो जाती है।'),
  feat3Title: L('Government-ready reports', 'সরকারি ফরম্যাটে রিপোর্ট', 'Government-ready reports'),
  feat3Desc: L(
    'UDISE+ format exports for block and district offices, with student data protected under India’s DPDP law.',
    'ব্লক ও জেলা অফিসের জন্য UDISE+ ফরম্যাট রিপোর্ট, সঙ্গে ভারতের DPDP আইন অনুযায়ী ছাত্রদের তথ্য সুরক্ষা।',
    'Block और district offices के लिए UDISE+ format exports, साथ में India के DPDP law के तहत student data protection।'
  ),

  roiKicker: L('Savings calculator', 'সাশ্রয়ের হিসাব', 'Saving Calculator'),
  roiTitle: L('See how much time your school saves', 'আপনার বিদ্যালয় কতটা সময় বাঁচবে দেখুন', 'देखें आपका school कितना time बचाता है'),
  roiSliderLabel: L('Number of students in your school', 'আপনার বিদ্যালয়ের শিক্ষার্থী সংখ্যা', 'आपके school में कितने students हैं'),
  roiStudents: L('students', 'শিক্ষার্থী', 'students'),
  roiHoursLabel: L('Teacher hours saved', 'শিক্ষকদের সময় সাশ্রয়', 'Teachers का time बचा'),
  roiPaperLabel: L('Register pages saved', 'খাতার পাতার সাশ্রয়', 'Register pages बचे'),
  roiPerYear: L('per year', 'প্রতি বছর', 'हर साल'),
  roiPoint1: L('Morning roll call finished in under 2 minutes', 'সকালের হাজিরা শেষ মাত্র ২ মিনিটে', 'सुबह की roll call 2 minutes से कम में complete'),
  roiPoint2: L('Every attendance record automatically backed up', 'প্রতিটি উপস্থিতির স্বয়ংক্রিয় ব্যাকআপ', 'हर attendance record automatically backed up'),
  roiNote: L(
    'How we estimate: about 5 seconds saved per student per day across 220 school days, and roughly one paper register page per student per week.',
    'কীভাবে হিসাব করি: প্রতি ছাত্র প্রতিদিন প্রায় ৫ সেকেন্ড সাশ্রয় (বছরে ২২০টি স্কুল দিবস) এবং প্রতি ছাত্র প্রতি সপ্তাহে প্রায় ১ পাতা খাতা সাশ্রয়।',
    'Estimate कैसे करते हैं: हर student के लिए रोज़ करीब 5 seconds की बचत (साल में 220 school days), और हर student हर हफ्ते करीब 1 register page की बचत।'
  ),

  ctaKicker: L('Next step', 'পরবর্তী ধাপ', 'अगला Step'),
  ctaTitle: L('Bring 2-minute attendance to your school', 'আপনার বিদ্যালয়ে আনুন ২ মিনিটের হাজিরা', 'अपने school में 2-minute attendance लाएं'),
  ctaSubtitle: L(
    'Book a free 15-minute demo — we show everything on your own phone. No commitment needed.',
    'ফ্রি ১৫ মিনিটের ডেমো বুক করুন — আপনার নিজের ফোনেই সব দেখিয়ে দেব। কোনো বাধ্যবাধকতা নেই।',
    'Free 15-minute demo book करें — हम आपके अपने phone पर सब कुछ दिखाएंगे। कोई commitment नहीं।'
  ),
  ctaContact: L('Questions? Write to us', 'কোনো প্রশ্ন? আমাদের লিখুন', 'कोई सवाल? हमें लिखें'),

  footerCompliance: L('Student data protected under India’s DPDP Act. UDISE+ format supported.', 'ভারতের DPDP আইন অনুযায়ী ছাত্রদের তথ্য সুরক্ষিত। UDISE+ ফরম্যাট সমর্থিত।', 'India के DPDP Act के तहत student data सुरक्षित। UDISE+ format supported।'),
  footerPrivacy: L('Privacy Policy', 'গোপনীয়তা নীতি', 'Privacy Policy'),
  footerTerms: L('Terms of Use', 'ব্যবহারের শর্তাবলী', 'Terms of Use'),
  footerContact: L('Contact', 'যোগাযোগ', 'Contact'),

  demoTitle: L('Book a free school demo', 'ফ্রি স্কুল ডেমো বুক করুন', 'Free school demo book करें'),
  demoDesc: L('We will call you within 4 working hours to schedule a 15-minute demo on your own phone.', 'আপনার নিজের ফোনে ১৫ মিনিটের ডেমোর সময় ঠিক করতে ৪ কর্মঘণ্টার মধ্যে আমরা আপনাকে কল করব।', '15-minute demo schedule करने के लिए हम 4 working hours में आपको call करेंगे।'),
  demoName: L('Your full name', 'আপনার পুরো নাম', 'आपका पूरा नाम'),
  demoPhone: L('Mobile number', 'মোবাইল নম্বর', 'Mobile number'),
  demoEmail: L('Email (optional)', 'ইমেল (ঐচ্ছিক)', 'Email (optional)'),
  demoSchool: L('School name', 'বিদ্যালয়ের নাম', 'School का नाम'),
  demoDistrict: L('District', 'জেলা', 'District'),
  demoStudents: L('Number of students', 'শিক্ষার্থীর সংখ্যা', 'Students की संख्या'),
  demoSubmit: L('Request Demo', 'ডেমোর অনুরোধ করুন', 'Demo Request करें'),
  demoCancel: L('Cancel', 'বাতিল', 'Cancel'),
  demoSuccessTitle: L('Demo request received!', 'ডেমোর অনুরোধ পৌঁছেছে!', 'Demo request मिल गई!'),
  demoSuccessBody: L('Thank you! We will call you within 4 working hours to fix a time.', 'ধন্যবাদ! সময় ঠিক করতে ৪ কর্মঘণ্টার মধ্যে আমরা আপনাকে কল করব।', 'धन्यवाद! Time fix करने के लिए हम 4 working hours में आपको call करेंगे।'),
  demoDone: L('Done', 'ঠিক আছে', 'ठीक है'),
  demoError: L('Could not send the request. Please check the details and try again.', 'অনুরোধ পাঠানো যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।', 'Request send नहीं हो सकी। Details check करके फिर try करें।'),
  demoNetworkError: L('No internet connection. Please try again when you are back online.', 'ইন্টারনেট সংযোগ নেই। অনলাইনে এলে আবার চেষ্টা করুন।', 'Internet connection नहीं है। Online आने पर फिर try करें।'),
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
    name: L('1. See it', '১. দেখুন', '1. देखें'),
    title: L('See how it works', 'কীভাবে কাজ করে দেখুন', 'कैसे काम करता है देखें'),
    subtitle: L('We show you how one card scan takes about a second — on any phone, with no internet.', 'কীভাবে মাত্র এক সেকেন্ডে একটি কার্ড স্ক্যান হয় — যেকোনো ফোনে, ইন্টারনেট ছাড়াই — আমরা আপনাকে দেখিয়ে দেব।', 'एक card scan करीब एक second में कैसे होता है — किसी भी phone पर, बिना internet के — हम आपको दिखाएंगे।'),
    deliverable: L('A clear picture of the system', 'সিস্টেম সম্পর্কে স্পষ্ট ধারণা', 'System की साफ तस्वीर'),
    image: '/assets/steps/step-1.jpg',
    badge: L('1-second scan', '১ সেকেন্ডের স্ক্যান', '1-second scan'),
    tag: L('Classroom ready', 'ক্লাসের জন্য প্রস্তুত', 'Classroom ready'),
  },
  {
    step: 2,
    key: 'compliance',
    name: L('2. Check the rules', '২. নিয়ম যাচাই', '2. Rules check करें'),
    title: L('Check compliance & privacy', 'নিয়ম ও গোপনীয়তা যাচাই', 'Compliance और privacy check करें'),
    subtitle: L('See UDISE+ format reports and how student data stays protected under India’s DPDP law.', 'UDISE+ ফরম্যাটের রিপোর্ট দেখুন এবং ভারতের DPDP আইন অনুযায়ী ছাত্রদের তথ্য কীভাবে সুরক্ষিত থাকে তা জানুন।', 'UDISE+ format reports देखें और India के DPDP law के तहत student data कैसे safe रहता है जानें।'),
    deliverable: L('Compliance checklist', 'কমপ্লায়েন্স তালিকা', 'Compliance checklist'),
    image: '/assets/steps/step-2.jpg',
    badge: L('UDISE+ format', 'UDISE+ ফরম্যাট', 'UDISE+ format'),
    tag: L('Govt standard', 'সরকারি মান', 'Govt standard'),
  },
  {
    step: 3,
    key: 'demo',
    name: L('3. Try it live', '৩. ডেমো নিন', '3. Live try करें'),
    title: L('Hands-on demo for your staff', 'আপনার কর্মীদের জন্য হাতে-কলমে ডেমো', 'आपके staff के लिए hands-on demo'),
    subtitle: L('A free 15-minute live trial where your headmaster and teachers test attendance themselves.', 'ফ্রি ১৫ মিনিটের লাইভ ট্রায়াল, যেখানে আপনার প্রধান শিক্ষক ও শিক্ষকরা নিজেরাই উপস্থিতি পরীক্ষা করবেন।', 'Free 15-minute live trial जिसमें आपके headmaster और teachers खुद attendance test करेंगे।'),
    deliverable: L('Free trial workspace', 'ফ্রি ট্রায়াল ওয়ার্কস্পেস', 'Free trial workspace'),
    image: '/assets/steps/step-3.jpg',
    badge: L('Free trial', 'ফ্রি ট্রায়াল', 'Free trial'),
    tag: L('Staff walkthrough', 'কর্মীদের পরিচিতি', 'Staff walkthrough'),
  },
  {
    step: 4,
    key: 'agreement',
    name: L('4. Simple agreement', '৪. সহজ চুক্তি', '4. आसान agreement'),
    title: L('A simple, fair agreement', 'সহজ ও ন্যায্য চুক্তি', 'एक आसान, fair agreement'),
    subtitle: L('A straightforward school agreement. Your school owns 100% of its data — no lock-in.', 'একটি সহজ বিদ্যালয় চুক্তি। আপনার তথ্যের ১০০% মালিকানা আপনার বিদ্যালয়ের — কোনো লক-ইন নেই।', 'एक सीधा school agreement। आपके data का 100% मालिक आपका school — कोई lock-in नहीं।'),
    deliverable: L('Signed agreement', 'স্বাক্ষরিত চুক্তিপত্র', 'Signed agreement'),
    image: '/assets/steps/step-4.jpg',
    badge: L('You own your data', 'তথ্যের মালিক আপনি', 'Data के मालिक आप'),
    tag: L('Fair terms', 'ন্যায্য শর্ত', 'Fair terms'),
  },
  {
    step: 5,
    key: 'setup',
    name: L('5. School setup', '৫. স্কুল সেটআপ', '5. School setup'),
    title: L('We set up your school portal', 'আমরা আপনার স্কুল পোর্টাল তৈরি করি', 'हम आपका school portal बनाते हैं'),
    subtitle: L('Your school gets its own secure page and admin login — completely separate from every other school.', 'আপনার বিদ্যালয় নিজস্ব সুরক্ষিত পেজ ও অ্যাডমিন লগইন পায় — অন্য সব বিদ্যালয় থেকে সম্পূর্ণ আলাদা।', 'आपके school को अपना secure page और admin login मिलता है — हर दूसरे school से पूरी तरह अलग।'),
    deliverable: L('School portal & admin login', 'স্কুল পোর্টাল ও অ্যাডমিন লগইন', 'School portal और admin login'),
    image: '/assets/steps/step-5.jpg',
    badge: L('Private school page', 'নিজস্ব স্কুল পেজ', 'Private school page'),
    tag: L('Secure link', 'নিরাপদ লিংক', 'Secure link'),
  },
  {
    step: 6,
    key: 'students',
    name: L('6. Add students', '৬. ছাত্র যুক্ত', '6. Students add करें'),
    title: L('Import your student list', 'ছাত্রতালিকা যুক্ত করুন', 'अपनी student list import करें'),
    subtitle: L('Upload your existing Excel sheet — hundreds of students are added at once and ID cards are generated automatically.', 'আপনার বিদ্যমান এক্সেল ফাইল আপলোড করুন — একসাথে শত শত ছাত্র যুক্ত হয় এবং আইডি কার্ড নিজে থেকেই তৈরি হয়।', 'अपनी मौजूदा Excel sheet upload करें — सैकड़ों students एक साथ add हो जाते हैं और ID cards automatically बन जाते हैं।'),
    deliverable: L('Student list ready', 'ছাত্রতালিকা প্রস্তুত', 'Student list तैयार'),
    image: '/assets/steps/step-6.jpg',
    badge: L('Excel upload', 'এক্সেল আপলোড', 'Excel upload'),
    tag: L('Auto ID cards', 'স্বয়ংক্রিয় কার্ড', 'Auto ID cards'),
  },
  {
    step: 7,
    key: 'training',
    name: L('7. Train teachers', '৭. শিক্ষক প্রশিক্ষণ', '7. Teachers को train करें'),
    title: L('5-minute teacher training', '৫ মিনিটের শিক্ষক প্রশিক্ষণ', '5-minute teacher training'),
    subtitle: L('So simple that any teacher learns it in 5 minutes on their own phone.', 'এতই সহজ যে যেকোনো শিক্ষক নিজের ফোনে মাত্র ৫ মিনিটে শিখে যান।', 'इतना आसान कि कोई भी teacher अपने phone पर सिर्फ 5 minutes में सीख लेता है।'),
    deliverable: L('Teacher quick-start cards', 'শিক্ষকদের গাইড কার্ড', 'Teacher quick-start cards'),
    image: '/assets/steps/step-7.jpg',
    badge: L('5-minute training', '৫ মিনিটের প্রশিক্ষণ', '5-minute training'),
    tag: L('Easy for teachers', 'শিক্ষকদের জন্য সহজ', 'Teachers के लिए आसान'),
  },
  {
    step: 8,
    key: 'live',
    name: L('8. Go live', '৮. চালু করুন', '8. Live करें'),
    title: L('Your first morning', 'আপনার প্রথম সকাল', 'आपकी पहली सुबह'),
    subtitle: L('Gate and classroom attendance run together from day one — with automatic parent SMS alerts.', 'প্রথম দিন থেকেই গেট ও ক্লাসের উপস্থিতি একসাথে চলে — সঙ্গে স্বয়ংক্রিয় অভিভাবক এসএমএস।', 'पहले दिन से ही gate और classroom attendance साथ चलती है — साथ में automatic parent SMS alerts।'),
    deliverable: L('Fully running school', 'সম্পূর্ণ চালু ব্যবস্থা', 'पूरी तरह चालू school'),
    image: '/assets/steps/step-8.jpg',
    badge: L('Gate + class live', 'গেট + ক্লাস চালু', 'Gate + class live'),
    tag: L('Real results', 'প্রকৃত ফলাফল', 'Real results'),
  },
];
