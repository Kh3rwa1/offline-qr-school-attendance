/**
 * AttendEase School Operational Assumptions & Savings Calculator Model
 *
 * Provides transparent, configurable parameters for estimating teacher time,
 * paper register usage, and operational costs. All projections are explicitly
 * labeled as illustrative estimates.
 */

export interface SchoolAttendanceAssumptions {
  studentCount: number; // e.g. 750 students (bounded between 10 and 10,000)
  schoolDaysPerYear: number; // standard academic days (default: 220)
  classesCount: number; // estimated class sections (e.g. 15)
  paperRollCallMinutesPerSession: number; // minutes spent per paper roll call (default: 15)
  qrSecondsPerStudent: number; // seconds per individual QR camera scan (default: 3)
  rfidSecondsPerGateBatch: number; // seconds for RFID gate walk-through (default: 0.1)
  attendanceMode: 'QR' | 'RFID'; // selected digital mode
  teacherHourlyWageInr: number; // average teacher cost basis (default: ₹250/hr)
  paperRegisterCostPerStudentYearInr: number; // estimated annual paper register cost (default: ₹40)
  smsCostPerMessageInr: number; // carrier DLT SMS rate (default: ₹0.15)
  estimatedAbsenceRatePercent: number; // average absence rate (default: 8%)
  annualSubscriptionPerStudentInr: number; // AttendEase software cost (default: ₹130)
}

export const DEFAULT_ASSUMPTIONS: SchoolAttendanceAssumptions = {
  studentCount: 750,
  schoolDaysPerYear: 220,
  classesCount: 15,
  paperRollCallMinutesPerSession: 15,
  qrSecondsPerStudent: 3,
  rfidSecondsPerGateBatch: 0.1,
  attendanceMode: 'QR',
  teacherHourlyWageInr: 250,
  paperRegisterCostPerStudentYearInr: 40,
  smsCostPerMessageInr: 0.15,
  estimatedAbsenceRatePercent: 8,
  annualSubscriptionPerStudentInr: 130,
};

export interface CalculatedEstimates {
  sanitizedStudentCount: number;
  mode: 'QR' | 'RFID';
  paperAnnualTeacherHours: number;
  digitalAnnualTeacherHours: number;
  annualTeacherHoursSaved: number;
  annualPaperSheetsSaved: number;
  estimatedTeacherTimeValueSavedInr: number;
  estimatedPaperCostSavedInr: number;
  estimatedAnnualSmsCostInr: number;
  estimatedSoftwareCostInr: number;
  dailyAttendanceTimeFormatted: {
    paper: string;
    digital: string;
  };
  disclaimer: string;
}

export function sanitizeNumber(value: number | undefined | null, fallback: number, min = 0, max = 1000000): number {
  if (value === undefined || value === null || isNaN(value)) return fallback;
  const num = Number(value);
  if (!isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

export function calculateAttendanceEstimates(
  custom: Partial<SchoolAttendanceAssumptions> = {}
): CalculatedEstimates {
  const studentCount = Math.round(sanitizeNumber(custom.studentCount, DEFAULT_ASSUMPTIONS.studentCount, 0, 20000));
  const schoolDays = Math.round(sanitizeNumber(custom.schoolDaysPerYear, DEFAULT_ASSUMPTIONS.schoolDaysPerYear, 50, 365));
  const classesCount = Math.max(1, Math.round(sanitizeNumber(custom.classesCount, Math.max(1, Math.ceil(studentCount / 50)), 1, 500)));
  const paperMinutes = sanitizeNumber(custom.paperRollCallMinutesPerSession, DEFAULT_ASSUMPTIONS.paperRollCallMinutesPerSession, 1, 60);
  const qrSec = sanitizeNumber(custom.qrSecondsPerStudent, DEFAULT_ASSUMPTIONS.qrSecondsPerStudent, 0.5, 15);
  const rfidSec = sanitizeNumber(custom.rfidSecondsPerGateBatch, DEFAULT_ASSUMPTIONS.rfidSecondsPerGateBatch, 0.01, 2);
  const mode = custom.attendanceMode === 'RFID' ? 'RFID' : 'QR';
  const wage = sanitizeNumber(custom.teacherHourlyWageInr, DEFAULT_ASSUMPTIONS.teacherHourlyWageInr, 0, 5000);
  const paperCostPerStudent = sanitizeNumber(custom.paperRegisterCostPerStudentYearInr, DEFAULT_ASSUMPTIONS.paperRegisterCostPerStudentYearInr, 0, 1000);
  const smsRate = sanitizeNumber(custom.smsCostPerMessageInr, DEFAULT_ASSUMPTIONS.smsCostPerMessageInr, 0, 10);
  const absenceRate = sanitizeNumber(custom.estimatedAbsenceRatePercent, DEFAULT_ASSUMPTIONS.estimatedAbsenceRatePercent, 0, 100);
  const subCostPerStudent = studentCount < 300 ? 0 : sanitizeNumber(custom.annualSubscriptionPerStudentInr, DEFAULT_ASSUMPTIONS.annualSubscriptionPerStudentInr, 0, 10000);

  if (studentCount === 0) {
    return {
      sanitizedStudentCount: 0,
      mode,
      paperAnnualTeacherHours: 0,
      digitalAnnualTeacherHours: 0,
      annualTeacherHoursSaved: 0,
      annualPaperSheetsSaved: 0,
      estimatedTeacherTimeValueSavedInr: 0,
      estimatedPaperCostSavedInr: 0,
      estimatedAnnualSmsCostInr: 0,
      estimatedSoftwareCostInr: 0,
      dailyAttendanceTimeFormatted: {
        paper: '0 min',
        digital: '0 min',
      },
      disclaimer:
        'Illustrative estimate based on selected assumptions. Actual time, cost and savings vary by school, hardware, workflow and telecom provider.',
    };
  }

  // 1. Paper Time: classesCount * paperMinutes per day across academic year
  const dailyPaperMinutesTotal = classesCount * paperMinutes;
  const paperAnnualTeacherHours = Math.round((dailyPaperMinutesTotal * schoolDays) / 60);

  // 2. Digital Time:
  // If QR: studentCount * qrSec across the school per day (distributed across class teachers)
  // If RFID: studentCount * rfidSec across entrance gates
  const dailyDigitalSeconds = mode === 'RFID' ? studentCount * rfidSec : studentCount * qrSec;
  const dailyDigitalMinutesTotal = Math.max(0.5, dailyDigitalSeconds / 60);
  const digitalAnnualTeacherHours = Math.round((dailyDigitalMinutesTotal * schoolDays) / 60);

  // 3. Time Saved
  const annualTeacherHoursSaved = Math.max(0, paperAnnualTeacherHours - digitalAnnualTeacherHours);

  // 4. Paper Sheets Saved (approx. 4 register sheets per student per year for attendance + cross-reports)
  const annualPaperSheetsSaved = studentCount * 4;

  // 5. Cost Metrics
  const estimatedTeacherTimeValueSavedInr = Math.round(annualTeacherHoursSaved * wage);
  const estimatedPaperCostSavedInr = Math.round(studentCount * paperCostPerStudent);
  const annualAbsentDays = (studentCount * (absenceRate / 100)) * schoolDays;
  const estimatedAnnualSmsCostInr = Math.round(annualAbsentDays * smsRate);
  const estimatedSoftwareCostInr = Math.round(studentCount * subCostPerStudent);

  const paperMinutesPerClass = Math.round(paperMinutes);
  const digitalMinutesPerClass = mode === 'RFID' ? '< 1 min gate entry' : `~${Math.max(1, Math.round((studentCount / classesCount) * qrSec / 60))} min/class`;

  return {
    sanitizedStudentCount: studentCount,
    mode,
    paperAnnualTeacherHours,
    digitalAnnualTeacherHours,
    annualTeacherHoursSaved,
    annualPaperSheetsSaved,
    estimatedTeacherTimeValueSavedInr,
    estimatedPaperCostSavedInr,
    estimatedAnnualSmsCostInr,
    estimatedSoftwareCostInr,
    dailyAttendanceTimeFormatted: {
      paper: `${paperMinutesPerClass} min/class`,
      digital: digitalMinutesPerClass,
    },
    disclaimer:
      'Illustrative estimate based on selected assumptions. Actual time, cost and savings vary by school, hardware, workflow and telecom provider.',
  };
}

export const CALCULATION_METHODOLOGY = {
  en: {
    title: 'Calculation Methodology & Modeling Assumptions',
    points: [
      'Teacher Time: Calculated assuming 15 minutes per section per morning for manual roll call vs. ~3 seconds per student for individual QR scanning (or gate walk-through for UHF RFID).',
      'Academic Year: Modeled on a standard 220 working school days calendar in West Bengal.',
      'Paper Register Usage: Estimated at 4 register and reporting pages per enrolled student annually.',
      'Software Tier: Free forever for schools with under 300 enrolled students; ₹130 per student/year illustrative base tier above 300.',
      'SMS Notifications: Absence SMS modeled at standard telecom DLT rates (₹0.15/msg) assuming an 8% baseline daily absence rate.',
      'Disclaimer: These calculations provide an illustrative operational estimate. No specific monetary savings or attendance completion times are guaranteed.',
    ],
  },
  bn: {
    title: 'হিসাবের পদ্ধতি ও মূল ধারণাসমূহ',
    points: [
      'শিক্ষকদের সময়: হাতে রোল কলের জন্য সেকশন প্রতি ১৫ মিনিট বনাম কিউআর স্ক্যানে প্রতি ছাত্রে প্রায় ৩ সেকেন্ড (অথবা আরএফআইডি গেটে স্বয়ংক্রিয় প্রবেশ)।',
      'স্কুল ক্যালেন্ডার: পশ্চিমবঙ্গে বছরে গড়ে ২২০টি কর্মদিবসের ওপর ভিত্তি করে তৈরি।',
      'কাগজের খাতার ব্যবহার: প্রতি শিক্ষার্থীর জন্য বছরে প্রায় ৪ পাতা রেজিস্টার ও রিপোর্ট কাগজ সাশ্রয়।',
      'সফ্টওয়্যার মূল্য: ৩০০-এর কম শিক্ষার্থী বিশিষ্ট বিদ্যালয়ের জন্য সম্পূর্ণ বিনামূল্যে; ৩০০-এর বেশি ক্ষেত্রে বাৎসরিক ₹১৩০/শিক্ষার্থী।',
      'এসএমএস খরচ: দৈনিক গড়ে ৮% অনুপস্থিতি ধরে সরকারি ডিএলটি রেটে (প্রতি এসএমএস ₹০.১৫) হিসাবকৃত।',
      'সতর্কবার্তা: এটি একটি আনুমানিক হিসাব। বাস্তব ফলাফল বিদ্যালয়ের পরিচালনা ও টেলিকম সংযোগের ওপর নির্ভর করে।',
    ],
  },
  hi: {
    title: 'गणना पद्धति एवं मानक अनुमान',
    points: [
      'शिक्षक का समय: हाथ से उपस्थिति के लिए प्रति सेक्शन 15 मिनट बनाम क्यूआर स्कैन में प्रति छात्र लगभग 3 सेकंड।',
      'शैक्षणिक वर्ष: प्रति वर्ष 220 कार्य दिवसों के मानक कैलेंडर पर आधारित।',
      'कागज़ी रजिस्टर: प्रति छात्र प्रति वर्ष लगभग 4 रजिस्टर व रिपोर्ट पृष्ठों की बचत।',
      'सॉफ़्टवेयर शुल्क: 300 से कम छात्रों वाले स्कूलों के लिए निःशुल्क; उससे अधिक पर ₹130 प्रति छात्र/वर्ष सांकेतिक दर।',
      'एसएमएस सूचना: औसतन 8% अनुपस्थिति दर पर मानक डीएलटी दर (₹0.15/एसएमएस) पर अनुमानित।',
      'अस्वीकरण: यह गणना केवल सांकेतिक अनुमान है। वास्तविक परिणाम विद्यालय की कार्यप्रणाली पर निर्भर करते हैं।',
    ],
  },
};
