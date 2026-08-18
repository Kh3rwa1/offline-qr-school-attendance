/**
 * Centralized Landing Page Localization Dictionary
 *
 * Full three-language coverage:
 * - English (en)
 * - বাংলা (bn) - Bengalish natural tone
 * - हिन्दी (hi) - Authentic standard Hindi (no Hinglish)
 *
 * Every user-facing string on the public landing page is centralized here.
 */

export type LocalizedText = { en: string; bn: string; hi: string };
export const L = (en: string, bn: string, hi: string): LocalizedText => ({ en, bn, hi });

export const LANDING_COPY = {
  // Navigation & Header
  navHowItWorks: L('How it works', 'কীভাবে কাজ করে', 'कार्यप्रणाली'),
  navGettingStarted: L('Getting started', 'শুরু করার ধাপ', 'शुरुआती चरण'),
  navPricing: L('Pricing', 'মূল্য ও প্ল্যান', 'मूल्य निर्धारण'),
  navSavings: L('Savings', 'সাশ্রয়ের হিসাব', 'बचत अनुमान'),
  navContact: L('Contact', 'যোগাযোগ', 'संपर्क'),
  signIn: L('School Sign In', 'স্কুল লগইন', 'स्कूल लॉगिन'),
  bookDemo: L('Book a Free Demo', 'ফ্রি ডেমো বুক করুন', 'निःशुल्क डेमो बुक करें'),
  langLabel: L('Select Language', 'ভাষা নির্বাচন করুন', 'भाषा चुनें'),
  skipToContent: L('Skip to main content', 'মূল কন্টেন্টে যান', 'मुख्य सामग्री पर जाएं'),

  // Hero Section
  heroBadge: L('Offline-first school attendance', 'অফলাইন-ফার্স্ট স্কুল হাজিরা', 'ऑफ़लाइन-प्रथम विद्यालय उपस्थिति'),
  heroTitle1: L('Morning attendance in minutes.', 'কয়েক মিনিটেই সকালের হাজিরা।', 'मिनटों में सुबह की उपस्थिति।'),
  heroTitle2: L('Even with no internet.', 'ইন্টারনেট ছাড়াও চলে।', 'इंटरनेट के बिना भी।'),
  heroSubtitleDefault: L(
    'Students walk through the gate with RFID badges, or teachers scan cards on mobile cameras. Records save securely on-device and sync automatically when internet returns. Structured internal exports ready for school review.',
    'শিক্ষার্থীরা আরএফআইডি ব্যাজ নিয়ে প্রবেশ করে, অথবা শিক্ষকরা মোবাইল ক্যামেরায় কার্ড স্ক্যান করেন। তথ্য নিরাপদে ডিভাইসে জমা থাকে এবং ইন্টারনেট এলে সিঙ্ক হয়। পর্যালোচনার জন্য প্রস্তুত অভ্যন্তরীণ রিপোর্ট।',
    'छात्र आरएफआईडी बैज के साथ प्रवेश करते हैं, या शिक्षक मोबाइल कैमरे से कार्ड स्कैन करते हैं। विवरण सुरक्षित रूप से डिवाइस पर सहेजे जाते हैं और इंटरनेट मिलने पर स्वतः सिंक होते हैं। स्कूल समीक्षा हेतु तैयार आंतरिक रिपोर्ट।'
  ),
  watchDemoLink: L('Watch 2-min demo →', '২ মিনিটের ডেমো দেখুন →', '2 मिनट का डेमो देखें →'),

  // Hero Floating Badges & Register Preview
  pillSetup: L('Quick appliance setup', 'দ্রুত সেটআপ ব্যবস্থা', 'त्वरित सेटअप प्रक्रिया'),
  pillOffline: L('Works 100% offline', '১০০% অফলাইনে চলে', '100% ऑफ़लाइन कार्यक्षम'),
  pillSms: L('Parent absence notifications', 'অনুপস্থিতির অভিভাবক বার্তা', 'अभिभावक अनुपस्थिति सूचना'),
  pillUdise: L('UDISE+-oriented layout', 'UDISE+ উপযোগী বিন্যাস', 'UDISE+ प्रारूप आधारित'),
  regTitle: L('DAILY ATTENDANCE REGISTER', 'দৈনিক শ্রেণি হাজিরা খাতা', 'दैनिक कक्षा उपस्थिति पंजी'),
  regPresent: L('PRESENT [P]', 'উপস্থিত [P]', 'उपस्थित [P]'),
  regOfflineTag: L('LOCAL DEVICE STORAGE', 'লোকাল ডিভাইস স্টোরেজ', 'स्थानीय डिवाइस स्टोरेज'),

  // Capabilities Strip
  capOffline: L('Works 100% offline', '১০০% অফলাইনে চলে', '100% ऑफ़लाइन संचालित'),
  capRfid: L('UHF RFID gate compatible', 'UHF RFID গেট উপযোগী', 'UHF RFID गेट संगत'),
  capUdise: L('UDISE+-oriented internal reports', 'UDISE+ ভিত্তিক অভ্যন্তরীণ রিপোর্ট', 'UDISE+ आधारित आंतरिक रिपोर्ट'),
  capSms: L('Parent absence SMS queue', 'অনুপস্থিতির এসএমএস কিউ', 'अभिभावक अनुपस्थिति संदेश कतार'),
  capBilingual: L('English + বাংলা + हिन्दी', 'English + বাংলা + हिन्दी', 'English + বাংলা + हिन्दी'),
  capExcel: L('Excel & CSV student import', 'এক্সেল ও সিএসভি ডেটা ইমপোর্ট', 'एक्सेल व सीएसवी डेटा आयात'),

  // Section 1: How It Works
  howKicker: L('How it works', 'কীভাবে কাজ করে', 'कार्यप्रणाली'),
  howTitle: L('Two transparent ways to take attendance', 'উপস্থিতি গ্রহণের দুটি সহজ ও স্বচ্ছ মাধ্যম', 'उपस्थिति दर्ज करने के दो सरल माध्यम'),
  howCard1Title: L('Individual QR scan or gate walk-through', 'ব্যক্তিগত কিউআর স্ক্যান বা আরএফআইডি গেট', 'व्यक्तिगत क्यूआर स्कैन अथवा आरएफआईडी गेट'),
  howCard1Desc: L(
    'Teachers scan individual student QR cards using a supported phone camera, or students pass through a commissioned UHF RFID gate antenna.',
    'শিক্ষকরা সমর্থিত মোবাইল ক্যামেরায় শিক্ষার্থীর কিউআর কার্ড স্ক্যান করেন, অথবা শিক্ষার্থীরা আরএফআইডি গেট অ্যান্টেনা দিয়ে স্বাভাবিকভাবে হেঁটে প্রবেশ করে।',
    'शिक्षक समर्थित मोबाइल कैमरे से छात्र के क्यूआर कार्ड को स्कैन करते हैं, अथवा छात्र आरएफआईडी गेट एंटीना के माध्यम से सामान्य रूप से प्रवेश करते हैं।'
  ),
  howCard1Cta: L('Try a simulated scan', 'নমুনা স্ক্যান পরীক্ষা করুন', 'नमूना स्कैन का परीक्षण करें'),
  howCard1Scanning: L('Scanning…', 'স্ক্যান হচ্ছে…', 'स्कैन हो रहा है…'),
  simVerified: L('Attendance marked', 'উপস্থিতি নথিভুক্ত', 'उपस्थिति दर्ज हुई'),
  simInstant: L('Validated on-device', 'ডিভাইসে তৎক্ষণাৎ যাচাইকৃত', 'डिवाइस पर सत्यापित'),
  simNote: L('Simulated illustration — uses synthetic test records only', 'শুধুমাত্র নমুনা উদাহরণ — কাল্পনিক ডেটা দ্বারা প্রদর্শিত', 'केवल सांकेतिक उदाहरण — कृत्रिम डेटा द्वारा प्रदर्शित'),
  howCard2Title: L('Automatic sync when connected', 'সংযোগ ফিরলে স্বয়ংক্রিয় সিঙ্ক', 'नेटवर्क मिलने पर स्वतः सिंक'),
  howCard2Desc: L(
    'When the device reconnects to local Wi-Fi or mobile data, stored records upload securely. Data is ready for internal export and school administration review.',
    'ডিভাইসটি লোকাল ওয়াই-ফাই বা ইন্টারনেটের সাথে যুক্ত হলে সংরক্ষিত ডেটা নিরাপদে সিঙ্ক হয় এবং প্রশাসনিক পর্যালোচনার জন্য প্রস্তুত থাকে।',
    'जब डिवाइस स्थानीय वाई-फ़ाई या इंटरनेट से पुनः जुड़ता है, तो डेटा सुरक्षित रूप से सिंक होता है और प्रशासनिक समीक्षा हेतु उपलब्ध रहता है।'
  ),
  howCard2Cta: L('Sign in to your school workspace', 'আপনার বিদ্যালয় পোর্টালে লগইন করুন', 'अपने स्कूल पोर्टल में लॉगिन करें'),

  // Section 2: Getting Started (8 Clear Steps)
  startKicker: L('Getting started', 'শুরু করার ধাপ', 'आरंभ करने के चरण'),
  startTitle: L('From setup to first morning — 8 clear steps', 'পরিকল্পনা থেকে প্রথম সকাল — মাত্র ৮টি স্পষ্ট ধাপ', 'योजना से पहली सुबह तक — 8 स्पष्ट चरण'),
  startBoxLabel: L('What your school receives', 'আপনার বিদ্যালয় যা পাবে', 'आपके विद्यालय को क्या प्राप्त होगा'),
  startPromise: L('Structured morning attendance with zero paper clutter', 'কাগজের ঝামেলাহীন শৃঙ্খলিত সকালের হাজিরা', 'कागज़ी झंझट से मुक्त व्यवस्थित उपस्थिति प्रक्रिया'),
  startDeliverable: L('Deliverable', 'প্রাপ্ত সামগ্রী', 'उपलब्ध सामग्री'),
  stepWord: L('Step', 'ধাপ', 'चरण'),

  // Section 3: Built for Real Classrooms
  featTitle: L('Engineered for real school environments', 'বাস্তব গ্রামীণ ও শহরতলীর বিদ্যালয়ের উপযোগী', 'वास्तविक स्कूल परिस्थितियों के अनुकूल'),
  featSubtitle: L(
    'Designed for the practical realities of daily school operations — power fluctuations, weak cellular reception, and busy morning entries.',
    'দৈনন্দিন বাস্তব পরিস্থিতি মাথায় রেখে তৈরি — বিদ্যুৎ বিভ্রাট, দুর্বল মোবাইল নেটওয়ার্ক এবং ব্যস্ত সকালের সমাবেশ।',
    'दैनिक व्यावहारिक परिस्थितियों को ध्यान में रखकर निर्मित — बिजली की कटौती, कमजोर मोबाइल नेटवर्क और सुबह की व्यस्तता।'
  ),
  feat1Title: L('Runs on existing mobile devices', 'বিদ্যমান মোবাইল ফোনেই চলে', 'मौजूदा मोबाइल फोन पर कार्यक्षम'),
  feat1Desc: L(
    'Teachers use standard web browsers on their existing smartphones. No proprietary handheld devices or expensive annual hardware maintenance required for QR mode.',
    'শিক্ষকরা তাদের নিজস্ব স্মার্টফোনের সাধারণ ওয়েব ব্রাউজারে এটি ব্যবহার করতে পারেন। কিউআর মোডের জন্য কোনো দামি যন্ত্র কেনার প্রয়োজন নেই।',
    'शिक्षक अपने स्मार्टफोन के सामान्य वेब ब्राउज़र में इसका उपयोग कर सकते हैं। क्यूआर मोड के लिए किसी महंगे उपकरण की आवश्यकता नहीं है।'
  ),
  feat2Title: L('Resilient offline storage', 'নির্ভরযোগ্য অফলাইন স্টোরেজ', 'विश्वसनीय ऑफ़लाइन स्टोरेज'),
  feat2Desc: L(
    'Attendance records write directly to tamper-resistant IndexedDB storage and sync idempotently to PostgreSQL when the connection is restored.',
    'উপস্থিতির তথ্য সরাসরি সুরক্ষিত ব্রাউজার স্টোরেজে জমা থাকে এবং ইন্টারনেট সংযোগ ফিরলে নির্ভুলভাবে সার্ভারে সিঙ্ক হয়।',
    'उपस्थिति विवरण सीधे सुरक्षित ब्राउज़र स्टोरेज में सहेजे जाते हैं और इंटरनेट पुनः सक्रिय होने पर सर्वर पर सिंक होते हैं।'
  ),
  feat3Title: L('Reports prepared for school review', 'প্রশাসনিক পর্যালোচনার উপযোগী রিপোর্ট', 'प्रशासनिक समीक्षा हेतु तैयार रिपोर्ट'),
  feat3Desc: L(
    'Structured internal exports formatted for administrative workflows, with records protected using DPDP-aligned privacy and access controls.',
    'প্রশাসনিক কাজের উপযোগী সুসংগঠিত রিপোর্ট এক্সপোর্ট, যেখানে তথ্যের সুরক্ষা DPDP নীতিমালার আলোকে নিশ্চিত করা হয়।',
    'प्रशासनिक कार्यों के लिए सुव्यवस्थित आंतरिक रिपोर्ट निर्यात, जहाँ डेटा सुरक्षा DPDP सिद्धांतों के अनुरूप सुनिश्चित की जाती है।'
  ),

  // Demo Video Section
  videoKicker: L('See it in action', 'সরাসরি দেখে নিন', 'कार्यप्रणाली देखें'),
  videoTitle: L('Watch a live walkthrough of AttendEase OS', 'অ্যাটেন্ডইজ ওএস-এর সরাসরি উপস্থাপনা দেখুন', 'अटेंडईज़ ओएस का लाइव वॉकथ्रू देखें'),
  videoSubtitle: L(
    'See how cards are scanned and records are reviewed without relying on an active internet connection.',
    'ইন্টারনেট সংযোগ ছাড়াও কীভাবে কার্ড স্ক্যান ও উপস্থিতি যাচাই করা যায় তা বিস্তারিত দেখুন।',
    'देखें कि बिना सक्रिय इंटरनेट कनेक्शन के भी कार्ड कैसे स्कैन और सत्यापित किए जाते हैं।'
  ),
  videoCardTitle: L('Watch a live 2-minute walkthrough', '২ মিনিটের সংক্ষিপ্ত পরিচিতি দেখুন', '2 मिनट का लाइव वॉकथ्रू देखें'),
  videoCardDesc: L(
    'Schedule a personalized online demonstration on your own device with an AttendEase specialist.',
    'আপনার নিজের ডিভাইসেই অ্যাটেন্ডইজ বিশেষজ্ঞদের সাথে একটি নিখরচায় লাইভ ডেমোর সময় নির্ধারণ করুন।',
    'अपने स्वयं के डिवाइस पर अटेंडईज़ विशेषज्ञों के साथ एक निःशुल्क लाइव डेमो शेड्यूल करें।'
  ),
  videoWatchBtn: L('Request a Live Demo →', 'লাইভ ডেমোর অনুরোধ করুন →', 'लाइव डेमो का अनुरोध करें →'),
  videoIframeTitle: L('AttendEase product demonstration video', 'অ্যাটেন্ডইজ প্রোডাক্ট ডেমো ভিডিও', 'अटेंडईज़ उत्पाद डेमो वीडियो'),

  // Pricing Section
  pricingKicker: L('Simple & Transparent', 'সহজ ও স্পষ্ট মূল্য তালিকা', 'सरल एवं पारदर्शी मूल्य निर्धारण'),
  pricingTitle: L('Predictable plans with no hidden costs', 'স্বচ্ছ সাবস্ক্রিপশন, কোনো গোপন খরচ নেই', 'स्पष्ट योजनाएं, कोई छिपा हुआ शुल्क नहीं'),
  pricingSubtitle: L(
    'Community-focused pricing structured for primary, upper-primary, and secondary institutions.',
    'প্রাথমিক, উচ্চ-প্রাথমিক ও মাধ্যমিক বিদ্যালয়ের সামর্থ্য অনুযায়ী নির্ধারিত সাশ্রয়ী প্ল্যান।',
    'प्राथमिक, उच्च-प्राथमिक एवं माध्यमिक विद्यालयों के अनुकूल निर्धारित योजनाएं।'
  ),
  pricingAmount: L('₹130', '₹১৩০', '₹130'),
  pricingPerStudent: L('per student / year (illustrative tier)', 'প্রতি শিক্ষার্থী / বছর (আনুমানিক)', 'प्रति छात्र / वर्ष (सांकेतिक दर)'),
  pricingFreeNote: L('Small schools under 300 students — free platform access forever', '৩০০-এর কম শিক্ষার্থী বিশিষ্ট বিদ্যালয়ের জন্য প্ল্যাটফর্ম ব্যবহার চিরকাল বিনামূল্যে', '300 से कम छात्रों वाले छोटे स्कूलों के लिए प्लेटफ़ॉर्म हमेशा निःशुल्क'),
  pricingFeat1: L('Unlimited QR code scans on mobile cameras', 'মোবাইল ক্যামেরায় আনলিমিটেড কিউআর স্ক্যান', 'मोबाइल कैमरे पर असीमित क्यूआर स्कैन'),
  pricingFeat2: L('Offline-first operation without active internet', 'ইন্টারনেট সংযোগ ছাড়াই পূর্ণাঙ্গ অফলাইন কার্যক্রম', 'सक्रिय इंटरनेट के बिना पूर्ण ऑफ़लाइन संचालन'),
  pricingFeat3: L('UDISE+-oriented internal attendance exports', 'UDISE+ উপযোগী অভ্যন্তরীণ উপস্থিতি এক্সপোর্ট', 'UDISE+ प्रारूप आधारित आंतरिक उपस्थिति निर्यात'),
  pricingFeat4: L('Parent absence SMS queue integration', 'অনুপস্থিতির এসএমএস কিউ ইন্টিগ্রেশন', 'अभिभावक अनुपस्थिति एसएमएस कतार एकीकरण'),
  pricingFeat5: L('Multi-role access (Teachers, Admin, Viewers)', 'একাধিক ভূমিকাভিত্তিক লগইন (শিক্ষক, অ্যাডমিন, পরিদর্শক)', 'बहु-भूमिका आधारित लॉगिन (शिक्षक, व्यवस्थापक, दर्शक)'),
  pricingFeat6: L('Excel & CSV roster and report downloads', 'এক্সেল ও সিএসভি ফরম্যাটে রিপোর্ট ডাউনলোড', 'एक्सेल एवं सीएसवी प्रारूप में रिपोर्ट डाउनलोड'),

  // Savings & Comparison Calculator
  roiKicker: L('Interactive Estimator', 'ইন্টারেক্টিভ ক্যালকুলেটর', 'संवादात्मक अनुमानक'),
  roiTitle: L('Estimate potential operational time savings', 'সম্ভাব্য সময় ও কাগজ সাশ্রয়ের আনুমানিক হিসাব', 'संभावित समय एवं कागज़ बचत का अनुमान लगाएं'),
  roiSubtitle: L(
    'Adjust the parameters below to project potential administrative savings for your school.',
    'আপনার বিদ্যালয়ের প্রয়োজনীয়তা অনুযায়ী নিচের মানগুলো পরিবর্তন করে সম্ভাব্য সাশ্রয় দেখে নিন।',
    'अपने विद्यालय के अनुसार नीचे दिए गए मानों को बदलकर संभावित बचत का अनुमान देखें।'
  ),
  roiSliderLabel: L('Enrolled students in school', 'বিদ্যালয়ে শিক্ষার্থীর সংখ্যা', 'विद्यालय में नामांकित छात्रों की संख्या'),
  roiModeLabel: L('Attendance capture method', 'উপস্থিতি গ্রহণের মাধ্যম', 'उपस्थिति दर्ज करने का माध्यम'),
  roiModeQr: L('Mobile QR Scanner', 'মোবাইল কিউআর স্ক্যানার', 'मोबाइल क्यूआर स्कैनर'),
  roiModeRfid: L('UHF RFID Gate Antenna', 'UHF RFID গেট অ্যান্টেনা', 'UHF RFID गेट एंटीना'),
  roiStudents: L('students', 'শিক্ষার্থী', 'छात्र'),
  roiHoursLabel: L('Estimated teacher hours saved', 'শিক্ষকদের আনুমানিক সময় সাশ্রয়', 'शिक्षकों के अनुमानित समय की बचत'),
  roiPaperLabel: L('Estimated register pages saved', 'আনুমানিক খাতার পাতা সাশ্রয়', 'अनुमानित रजिस्टर पृष्ठों की बचत'),
  roiPerYear: L('per academic year', 'প্রতি শিক্ষাবর্ষে', 'प्रति शैक्षणिक वर्ष'),
  roiPoint1: L('Individual roll call replaced with rapid digital logging', 'হাতে ডাকার পরিবর্তে দ্রুত ডিজিটাল উপস্থিতি নথিভুক্তি', 'हाथ से उपस्थिति लेने के स्थान पर त्वरित डिजिटल रिकॉर्डिंग'),
  roiPoint2: L('Automated encrypted local backups with periodic verification', 'পর্যায়ক্রমিক যাচাইকরণ সহ স্বয়ংক্রিয় সুরক্ষিত ব্যাকআপ', 'नियमित सत्यापन के साथ स्वचालित सुरक्षित स्थानीय बैकअप'),
  roiMethodologyToggle: L('View calculation methodology & assumptions', 'হিসাবের পদ্ধতি ও মূল ধারণাসমূহ দেখুন', 'गणना पद्धति एवं मानक धारणाएं देखें'),
  roiDisclaimer: L(
    'Illustrative estimate based on selected assumptions. Actual time, cost and savings vary by school, hardware, workflow and telecom provider.',
    'নির্বাচিত ধারণার ওপর ভিত্তি করে একটি আনুমানিক হিসাব। বাস্তব সময় ও সাশ্রয় বিদ্যালয়ের কাজের ধরন ও হার্ডওয়্যারের ওপর নির্ভরশীল।',
    'चयनित धारणाओं पर आधारित एक सांकेतिक अनुमान। वास्तविक समय और बचत स्कूल की कार्यप्रणाली और हार्डवेयर पर निर्भर करती है।'
  ),

  // Comparison Table (Evidence-Based & Truthful)
  compHeaderFeature: L('Workflow Feature', 'কাজের বৈশিষ্ট্য', 'कार्यप्रणाली विशेषता'),
  compHeaderAE: L('AttendEase OS (Digital)', 'অ্যাটেন্ডইজ ওএস (ডিজিটাল)', 'अटेंडईज़ ओएस (डिजिटल)'),
  compHeaderPaper: L('Traditional Paper Registers', 'প্রথাগত কাগজের খাতা', 'पारंपरिक कागज़ी रजिस्टर'),
  compSubTitle: L('Comparison of operational workflows in typical 750-student secondary schools', '৭৫০ শিক্ষার্থীর একটি মাধ্যমিক বিদ্যালয়ের কাজের তুলনামূলক রূপরেখা', '750 छात्रों वाले स्कूल की कार्यप्रणाली का तुलनात्मक विवरण'),
  compRow1Feature: L('Morning roll call duration', 'সকালের উপস্থিতি গ্রহণের সময়কাল', 'सुबह की उपस्थिति का समय'),
  compRow1Ae: L('~1–3 min/class (QR) or walk-through (RFID)', 'ক্লাস প্রতি ~১–৩ মিনিট (QR) বা গেট ওয়াক-ইন (RFID)', '~1–3 मिनट/कक्षा (QR) या गेट प्रवेश (RFID)'),
  compRow1Paper: L('Estimated 15–20 min per section', 'সেকশন প্রতি গড়ে ১৫–২০ মিনিট', 'प्रति सेक्शन लगभग 15–20 मिनट'),
  compRow2Feature: L('Operation without internet', 'ইন্টারনেট সংযোগ ছাড়া কার্যক্রম', 'इंटरनेट के बिना संचालन'),
  compRow2Ae: L('Fully supported (local storage sync)', 'সম্পূর্ণ সমর্থিত (ডিভাইসে সংরক্ষিত থাকে)', 'पूर्णतः समर्थিত (स्थानीय स्टोरेज सिंक)'),
  compRow2Paper: L('Fully supported (physical paper)', 'সম্পূর্ণ সমর্থিত (কাগজ)', 'पूर्णतः समर्थित (कागज़)'),
  compRow3Feature: L('Administrative report preparation', 'প্রশাসনিক রিপোর্ট প্রস্তুতি', 'प्रशासनिक रिपोर्ट तैयार करना'),
  compRow3Ae: L('One-click structured export generation', 'এক ক্লিকে সুসংগঠিত রিপোর্ট এক্সপোর্ট', 'एक क्लिक में सुव्यवस्थित रिपोर्ट निर्यात'),
  compRow3Paper: L('Manual monthly tallying & compilation', 'হাতে গুণে প্রতি মাসে খাতা তৈরি', 'मासिक हाथ से गणना एवं संकलन'),
  compRow4Feature: L('Parent absence communications', 'অনুপস্থিতির অভিভাবক বার্তা', 'अभिभावक अनुपस्थिति सूचना'),
  compRow4Ae: L('Queued for telecom DLT dispatch', 'টেলিকম ডিএলটি মারফত পাঠানোর জন্য কিউ হয়', 'टेलीकॉम डीएलटी प्रेषण हेतु कतारबद्ध'),
  compRow4Paper: L('Manual phone calls or dairy notes', 'ম্যানুয়াল ফোন কল বা ডায়েরি নোট', 'मैनुअल फोन कॉल या डायरी संदेश'),
  compRow5Feature: L('Audit trail for corrections', 'সংশোধনের রেকর্ড ও অডিট ট্রেইল', 'संशोधनों का ऑडिट रिकॉर्ड'),
  compRow5Ae: L('Logged with timestamp & author identity', 'সময় ও ব্যবহারকারীর নাম সহ সংরক্ষিত', 'समय एवं उपयोगकर्ता नाम के साथ दर्ज'),
  compRow5Paper: L('Manual ink cross-outs on register', 'খাতায় পেন দিয়ে কাটাছেঁড়া', 'रजिस्टर पर हाथ से काटना'),

  // Reporting Disclaimer Banner (Phase 2 Requirement)
  reportingDisclaimerTitle: L('Important Reporting Notice', 'গুরুত্বপূর্ণ নোটিশ', 'महत्वपूर्ण सूचना'),
  reportingDisclaimerBody: L(
    'Exports are designed for internal school administration. An authorized school reviewer must verify them before external submission. AttendEase does not claim government approval or guaranteed portal acceptance.',
    'রিপোর্টগুলি বিদ্যালয়ের অভ্যন্তরীণ প্রশাসনিক কাজের জন্য তৈরি। বাইরে কোথাও জমা দেওয়ার আগে অনুমোদিত বিদ্যালয় কর্তৃপক্ষ দ্বারা যাচাই করা আবশ্যক। অ্যাটেন্ডইজ কোনো সরকারি অনুমোদন বা পোর্টাল গ্রহণের নিশ্চয়তার দাবি করে না।',
    'रिपोर्ट स्कूल के आंतरिक प्रशासनिक कार्यों के लिए तैयार की जाती हैं। किसी भी बाहरी प्रस्तुति से पहले अधिकृत स्कूल समीक्षक द्वारा सत्यापन आवश्यक है। अटेंडईज़ किसी भी सरकारी अनुमोदन अथवा पोर्टल स्वीकृति का दावा नहीं करता है।'
  ),

  // CTA Section
  ctaKicker: L('Next step', 'পরবর্তী পদক্ষেপ', 'अगला कदम'),
  ctaTitle: L('Explore modernized attendance for your school', 'আপনার বিদ্যালয়ের জন্য আধুনিক উপস্থিতির রূপরেখা জানুন', 'अपने स्कूल के लिए आधुनिक उपस्थिति प्रणाली जानें'),
  ctaSubtitle: L(
    'Schedule a 15-minute walkthrough on your smartphone or appliance. Review features with no commercial obligation.',
    'আপনার নিজস্ব স্মার্টফোনেই ১৫ মিনিটের একটি উপস্থাপনার সময় নির্ধারণ করুন। কোনো আর্থিক বাধ্যবাধকতা নেই।',
    'अपने स्मार्टफोन पर ही 15 मिनट के डेमो का समय तय करें। कोई बाध्यकारी शर्त नहीं है।'
  ),
  ctaContact: L('Questions? Write directly to our team', 'কোনো প্রশ্ন আছে? সরাসরি আমাদের লিখুন', 'कोई प्रश्न है? सीधे हमारी टीम को लिखें'),

  // Footer
  footerCompliance: L(
    'Protected using DPDP-aligned privacy and access controls. UDISE+-oriented layout supported.',
    'ভারতের DPDP নীতিমালার আলোকে তথ্য সুরক্ষিত। UDISE+ উপযোগী বিন্যাস সমর্থিত।',
    'भारत के DPDP सिद्धांतों के अनुसार डेटा सुरक्षित। UDISE+ प्रारूप समर्थित।'
  ),
  footerPrivacy: L('Privacy Policy', 'গোপনীয়তা নীতি', 'गोपनीयता नीति'),
  footerTerms: L('Terms of Use', 'ব্যবহারের শর্তাবলী', 'उपयोग की शर्तें'),
  footerContact: L('Contact', 'যোগাযোগ', 'संपर्क'),
  footerCopyright: L('© AttendEase OS. Built for Indian Schools.', '© অ্যাটেন্ডইজ ওএস। ভারতীয় বিদ্যালয়ের জন্য নির্মিত।', '© अटेंडईज़ ओएस। भारतीय विद्यालयों के लिए निर्मित।'),

  // Demo Form & Dialog (Phase 10 Privacy-Safe Requirements)
  demoTitle: L('Request a School Demonstration', 'বিদ্যালয় ডেমোর অনুরোধ জানান', 'स्कूल डेमो का अनुरोध करें'),
  demoDesc: L(
    'Our educational deployment team will reach out within 4 working hours to schedule a 15-minute walkthrough.',
    'আমাদের টিম ৪ কর্মঘণ্টার মধ্যে আপনার সাথে যোগাযোগ করে ১৫ মিনিটের অনলাইন ডেমোর সময়সূচি নির্ধারণ করবে।',
    'हमारी टीम 4 कार्य घंटों के भीतर आपसे संपर्क कर 15 मिनट के डेमो का समय निर्धारित करेगी।'
  ),
  demoName: L('Full Name of Contact Person', 'যোগাযোগকারীর পুরো নাম', 'संपर्क व्यक्ति का पूरा नाम'),
  demoNamePlaceholder: L('e.g. Principal Sourav Sen', 'যেমন: প্রধান শিক্ষক সৌরভ সেন', 'उदा. प्रधानाचार्य सौरव सेन'),
  demoPhone: L('Mobile Phone Number (E.164)', 'মোবাইল নম্বর (E.164)', 'मोबाइल नंबर (E.164)'),
  demoPhonePlaceholder: L('9876543210', '9876543210', '9876543210'),
  demoEmail: L('Institutional Email (Optional)', 'প্রাতিষ্ঠানিক ইমেল (ঐচ্ছিক)', 'संस्थागत ईमेल (वैकल्पिक)'),
  demoEmailPlaceholder: L('headmaster@school.edu.in', 'headmaster@school.edu.in', 'headmaster@school.edu.in'),
  demoSchool: L('Official School Name', 'বিদ্যালয়ের পূর্ণ নাম', 'विद्यालय का पूरा नाम'),
  demoSchoolPlaceholder: L('e.g. Rampur High School (H.S.)', 'যেমন: রামপুর হাই স্কুল', 'उदा. रामपुर हाई स्कूल'),
  demoDistrict: L('District & State', 'জেলা ও রাজ্য', 'ज़िला एवं राज्य'),
  demoDistrictPlaceholder: L('e.g. Bankura, West Bengal', 'যেমন: বাঁকুড়া, পশ্চিমবঙ্গ', 'उदा. बांकुड़ा, पश्चिम बंगाल'),
  demoStudents: L('Approximate Student Strength', 'আনুমানিক শিক্ষার্থী সংখ্যা', 'अनुमानित छात्र संख्या'),
  demoLangPref: L('Preferred Demonstration Language', 'ডেমোর জন্য পছন্দের ভাষা', 'डेमो के लिए पसंदीदा भाषा'),
  demoPurposeNotice: L(
    'Data Collection Notice: We collect this institutional contact information solely to schedule and conduct the requested product demonstration. No student data is collected through this form.',
    'তথ্য সংগ্রহ সংক্রান্ত বিজ্ঞপ্তি: এই তথ্য কেবলমাত্র অনুরোধকৃত ডেমোর সময় নির্ধারণ ও যোগাযোগের জন্য সংগ্রহ করা হয়। এই ফর্মে কোনো শিক্ষার্থীর ব্যক্তিগত তথ্য নেওয়া হয় না।',
    'डेटा संग्रह सूचना: हम यह संस्थागत संपर्क जानकारी केवल अनुरोधित डेमो के समय निर्धारण हेतु एकत्र करते हैं। इस फॉर्म द्वारा किसी छात्र का डेटा नहीं लिया जाता।'
  ),
  demoConsentLabel: L(
    'I agree to be contacted by the AttendEase team regarding this product demonstration request in accordance with the Privacy Policy.',
    'আমি গোপনীয়তা নীতি অনুযায়ী এই ডেমো সংক্রান্ত বিষয়ে অ্যাটেন্ডইজ টিমের সাথে যোগাযোগের সম্মতি দিচ্ছি।',
    'मैं गोपनीयता नीति के अनुसार इस डेमो अनुरोध के संबंध में अटेंडईज़ टीम द्वारा संपर्क किए जाने की सहमति देता/देती हूँ।'
  ),
  demoSubmit: L('Submit Demo Request', 'অনুরোধ জমা দিন', 'डेमो अनुरोध जमा करें'),
  demoCancel: L('Cancel', 'বাতিল', 'रद्द करें'),
  demoSubmitting: L('Submitting…', 'জমা হচ্ছে…', 'जमा हो रहा है…'),
  demoSuccessTitle: L('Demo request successfully received', 'ডেমোর অনুরোধ সফলভাবে পৌঁছেছে', 'डेमो अनुरोध सफलतापूर्वक प्राप्त हुआ'),
  demoSuccessBody: L(
    'Thank you! An AttendEase deployment specialist will contact you during business hours to confirm your scheduled walkthrough.',
    'ধন্যবাদ! আমাদের প্রতিনিধি কর্মঘণ্টার মধ্যে আপনার সাথে যোগাযোগ করে ডেমোর সময় নিশ্চিত করবেন।',
    'धन्यवाद! हमारे प्रतिनिधि कार्य घंटों के भीतर आपसे संपर्क कर डेमो के समय की पुष्टि करेंगे।'
  ),
  demoDone: L('Close', 'বন্ধ করুন', 'बंद करें'),
  demoConsentError: L(
    'Please acknowledge the consent checkbox to proceed.',
    'অনুগ্রহ করে এগিয়ে যেতে সম্মতির ঘরে টিক দিন।',
    'आगे बढ़ने के लिए कृपया सहमति बॉक्स को चुनें।'
  ),
  demoError: L(
    'Could not submit request. Please check the details and try again.',
    'অনুরোধ জমা দেওয়া যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।',
    'अनुरोध जमा नहीं हो सका। विवरण जांचकर पुनः प्रयास करें।'
  ),
  demoNetworkError: L(
    'No network connection. Please check your connectivity and try again.',
    'ইন্টারনেট সংযোগ নেই। নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।',
    'इंटरनेट कनेक्शन नहीं है। कृपया नेटवर्क जांचकर पुनः प्रयास करें।'
  ),
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
    name: L('1. See it', '১. পরিচিতি', '1. परिचय'),
    title: L('Understand the core workflow', 'মূল কাজের পদ্ধতি বুঝুন', 'मूल कार्यप्रणाली को समझें'),
    subtitle: L(
      'Review how a single camera scan or RFID gate pass records student presence on standard mobile devices without active connectivity.',
      'কীভাবে কোনো সক্রিয় ইন্টারনেট সংযোগ ছাড়াই সাধারণ মোবাইলে কার্ড স্ক্যান বা আরএফআইডি গেটে উপস্থিতি জমা হয় তা জেনে নিন।',
      'जानें कि बिना सक्रिय इंटरनेट कनेक्शन के भी साधारण मोबाइल पर कार्ड स्कैन अथवा आरएफआईडी गेट से उपस्थिति कैसे दर्ज होती है।'
    ),
    deliverable: L('Clear operational architecture overview', 'কাজের কাঠামোর স্পষ্ট ধারণা', 'कार्यप्रणाली की स्पष्ट रूपरेखा'),
    image: '/assets/steps/step-1.jpg',
    badge: L('Rapid scan', 'দ্রুত স্ক্যান', 'त्वरित स्कैन'),
    tag: L('Classroom ready', 'ক্লাসরুম উপযোগী', 'कक्षा अनुकूल'),
  },
  {
    step: 2,
    key: 'compliance',
    name: L('2. Review format', '২. ফরম্যাট যাচাই', '2. प्रारूप समीक्षा'),
    title: L('Review internal report structure & privacy', 'রিপোর্টের গঠন ও গোপনীয়তা বিধি দেখুন', 'रिपोर्ट संरचना एवं गोपनीयता समीक्षा'),
    subtitle: L(
      'Inspect UDISE+-oriented internal export templates and verify DPDP-aligned administrative access controls.',
      'UDISE+ ফরম্যাটের অভ্যন্তরীণ রিপোর্ট টেমপ্লেট এবং DPDP নীতিমালার আলোকে সুরক্ষাব্যবস্থা পর্যালোচনা করুন।',
      'UDISE+ आधारित आंतरिक रिपोर्ट प्रारूप और DPDP सिद्धांतों के अनुरूप डेटा सुरक्षा नियंत्रणों की समीक्षा करें।'
    ),
    deliverable: L('Internal reporting checklist', 'অভ্যন্তরীণ রিপোর্টিং চেকলিস্ট', 'आंतरिक रिपोर्टिंग चेकलिस्ट'),
    image: '/assets/steps/step-2.jpg',
    badge: L('UDISE+ oriented', 'UDISE+ উপযোগী', 'UDISE+ आधारित'),
    tag: L('Internal format', 'অভ্যন্তরীণ মান', 'आंतरिक प्रारूप'),
  },
  {
    step: 3,
    key: 'demo',
    name: L('3. Test live', '৩. লাইভ ট্রায়াল', '3. लाइव परीक्षण'),
    title: L('Hands-on trial for school staff', 'বিদ্যালয় কর্মীদের হাতে-কলমে ডেমো', 'स्कूल कर्मचारियों के लिए लाइव परीक्षण'),
    subtitle: L(
      'A structured 15-minute live trial where headmasters and teachers test attendance scanning on their existing mobile phones.',
      'একটি ১৫ মিনিটের লাইভ ট্রায়াল যেখানে প্রধান শিক্ষক ও সহকারী শিক্ষকরা নিজেদের ফোনেই উপস্থিতি গ্রহণ পরীক্ষা করেন।',
      'एक 15 मिनट का लाइव परीक्षण जिसमें प्रधानाचार्य और शिक्षक अपने मौजूदा मोबाइल फोन पर उपस्थिति परीक्षण करते हैं।'
    ),
    deliverable: L('Trial workspace evaluation', 'ট্রায়াল ওয়ার্কস্পেস পর্যালোচনা', 'परीक्षण वर्कस्पेस मूल्यांकन'),
    image: '/assets/steps/step-3.jpg',
    badge: L('Live trial', 'লাইভ ট্রায়াল', 'लाइव परीक्षण'),
    tag: L('Staff walkthrough', 'কর্মীদের পরিচিতি', 'कर्मचारी वॉकथ्रू'),
  },
  {
    step: 4,
    key: 'agreement',
    name: L('4. Agreement', '৪. স্বচ্ছ চুক্তি', '4. पारदर्शी अनुबंध'),
    title: L('Transparent school agreement', 'সহজ ও স্পষ্ট বিদ্যালয় চুক্তি', 'सरल एवं पारदर्शी स्कूल अनुबंध'),
    subtitle: L(
      'A straightforward institutional agreement. The school retains 100% ownership and custody of all attendance records.',
      'একটি সহজ বিদ্যালয় চুক্তিপত্র। সমস্ত উপস্থিতির তথ্যের ১০০% মালিকানা ও নিয়ন্ত্রণ সর্বদা বিদ্যালয়ের অধীনে থাকে।',
      'एक सीधा विद्यालय अनुबंध। सभी उपस्थिति रिकॉर्ड का 100% स्वामित्व एवं नियंत्रण हमेशा विद्यालय के पास रहता है।'
    ),
    deliverable: L('Institutional terms agreement', 'বিদ্যালয় চুক্তিপত্র', 'संस्थागत अनुबंध प्रपत्र'),
    image: '/assets/steps/step-4.jpg',
    badge: L('Full data custody', 'তথ্যের পূর্ণ মালিকানা', 'डेटा का पूर्ण स्वामित्व'),
    tag: L('Clear terms', 'স্বচ্ছ শর্তাবলী', 'स्पष्ट नियम व शर्तें'),
  },
  {
    step: 5,
    key: 'setup',
    name: L('5. School portal', '৫. স্কুল পোর্টাল', '5. स्कूल पोर्टल'),
    title: L('Configure school workspace', 'বিদ্যালয় পোর্টাল তৈরি', 'स्कूल वर्कस्पेस सेटअप'),
    subtitle: L(
      'Your school is provisioned with an isolated multi-tenant tenant context, dedicated database schema, and admin credentials.',
      'আপনার বিদ্যালয়ের জন্য সম্পূর্ণ পৃথক ডেটাবেস ও সুরক্ষিত অ্যাডমিন লগইন সহ নিজস্ব পোর্টাল তৈরি করা হয়।',
      'आपके विद्यालय के लिए पूरी तरह पृथक डेटाबेस और सुरक्षित व्यवस्थापक लॉगिन के साथ पोर्टल बनाया जाता है।'
    ),
    deliverable: L('School portal & administrator credentials', 'স্কুল পোর্টাল ও অ্যাডমিন লগইন', 'स्कूल पोर्टल एवं एडमिन लॉगिन'),
    image: '/assets/steps/step-5.jpg',
    badge: L('Private tenant workspace', 'নিজস্ব স্কুল পেজ', 'निजी स्कूल वर्कस्पेस'),
    tag: L('Isolated context', 'সম্পূর্ণ পৃথক', 'पूर्णतः सुरक्षित'),
  },
  {
    step: 6,
    key: 'students',
    name: L('6. Import roster', '৬. ছাত্র তালিকা', '6. छात्र सूची आयात'),
    title: L('Import student roster from Excel', 'এক্সেল থেকে ছাত্রতালিকা যুক্তকরণ', 'एक्सेल से छात्र सूची आयात करें'),
    subtitle: L(
      'Upload existing Excel or CSV student sheets. Student rosters and printable QR cards are organized automatically.',
      'আপনার বিদ্যমান এক্সেল বা সিএসভি ফাইল আপলোড করুন। ছাত্রতালিকা স্বয়ংক্রিয়ভাবে সাজানো হয় এবং প্রিন্টযোগ্য কিউআর তৈরি হয়।',
      'अपनी मौजूदा एक्सेल अथवा सीएसवी शीट अपलोड करें। छात्र सूची स्वतः व्यवस्थित होती है और प्रिंट योग्य क्यूआर तैयार होते हैं।'
    ),
    deliverable: L('Student roster & print-ready QR codes', 'প্রস্তুত ছাত্রতালিকা ও কিউআর কার্ড', 'छात्र सूची एवं प्रिंट योग्य क्यूआर'),
    image: '/assets/steps/step-6.jpg',
    badge: L('Excel import', 'এক্সেল আপলোড', 'एक्सेल आयात'),
    tag: L('Printable QR', 'প্রিন্টযোগ্য কিউআর', 'प्रिंट योग्य क्यूआर'),
  },
  {
    step: 7,
    key: 'training',
    name: L('7. Staff brief', '৭. শিক্ষক প্রশিক্ষণ', '7. शिक्षक प्रशिक्षण'),
    title: L('Brief teacher orientation', 'শিক্ষকদের সংক্ষিপ্ত পরিচিতি', 'शिक्षकों का संक्षिप्त प्रशिक्षण'),
    subtitle: L(
      'A simple 5-minute staff walkthrough ensuring class teachers can operate offline scanning and review unmarked rosters comfortably.',
      'সহজ ৫ মিনিটের একটি পরিচিতি পর্ব, যাতে শিক্ষকরা নির্বিঘ্নে অফলাইনে স্ক্যান ও অনুপস্থিত তালিকা পর্যালোচনা করতে পারেন।',
      'एक सरल 5 मिनट का सत्र जिससे शिक्षक आसानी से ऑफ़लाइन स्कैन और अनुपस्थित सूची की समीक्षा कर सकें।'
    ),
    deliverable: L('Teacher quick-reference card', 'শিক্ষক সহায়িকা কার্ড', 'शिक्षक त्वरित संदर्भ कार्ड'),
    image: '/assets/steps/step-7.jpg',
    badge: L('5-min orientation', '৫ মিনিটের পরিচিতি', '5 मिनट का प्रशिक्षण'),
    tag: L('Non-technical UI', 'সহজ ইন্টারফেস', 'सरल इंटरफ़ेस'),
  },
  {
    step: 8,
    key: 'live',
    name: L('8. Operational go-live', '৮. কার্যক্রম শুরু', '8. नियमित संचालन'),
    title: L('First morning live attendance', 'প্রথম দিনের সকালের হাজিরা', 'पहली सुबह की लाइव उपस्थिति'),
    subtitle: L(
      'Gate and classroom attendance run smoothly from morning assembly onwards, with absence jobs queued for review.',
      'প্রথম দিন থেকেই গেট বা ক্লাসের হাজিরা স্বাভাবিকভাবে সম্পন্ন হয় এবং অনুপস্থিতির তথ্য পর্যালোচনার জন্য জমা থাকে।',
      'पहले ही दिन से गेट अथवा कक्षा उपस्थिति सुचारू रूप से संचालित होती है और समीक्षा हेतु रिकॉर्ड दर्ज होते हैं।'
    ),
    deliverable: L('Active school attendance operations', 'চলতি হাজিরা ব্যবস্থা', 'सक्रिय उपस्थिति संचालन'),
    image: '/assets/steps/step-8.jpg',
    badge: L('Operational', 'সম্পূর্ণ সক্রিয়', 'पूर्णतः सक्रिय'),
    tag: L('Verified records', 'নথিভুক্ত তথ্য', 'सत्यापित विवरण'),
  },
];
