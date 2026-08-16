# West Bengal Rural School Plain-Language UAT Protocol & Verification Guide

## 1. Target User Persona & Device Baseline
- **Primary Persona**: 55-year-old Bengali-first primary school teacher in rural Purulia / Bankura, West Bengal.
- **Hardware Profile**: ₹10,000 Android smartphone (360px viewport width, low touch precision, 2G/3G intermittent connectivity).
- **Digital Literacy**: Basic smartphone knowledge (WhatsApp, YouTube, voice calling). Intimidated by English developer jargon and acronyms.
- **Language**: Reads Bengali (বাংলা) fluently; understands simple school-related English terms.

---

## 2. Core Usability Mandates Verified
1. **Zero Technical Jargon**: No raw UUIDs, cryptographic acronyms (AES, RLS, SHA, SigV4), or database terms exposed in normal teacher, gate operator, school admin, or report viewer workflows.
2. **Complete Bilingual Reactivity**: 100% reactive toggle between English and Bengali across all headers, cards, dialogs, form inputs, status chips, and error messages.
3. **Budget Mobile Touch Target Compliance**: All clickable elements (buttons, dropdowns, inputs, quick-action tiles) adhere to $\ge 44\text{px}$ touch targets (with $\ge 48\text{px}$ on bottom navigation bars).
4. **No Fake / Hardcoded Numbers**: All dashboards display real live data from SQLite/PostgreSQL APIs or honest empty states.
5. **Reassuring Offline & Error States**: Network interruptions clearly communicate that attendance is safely stored on the device with zero risk of data loss.

---

## 3. End-to-End Task Verification Scripts

### Script 1: Teacher Daily Classroom Roll (শ্রেণীকক্ষের উপস্থিতি)
1. **Start Attendance**:
   - Open Teacher Dashboard.
   - Choose assigned class from large dropdown (`min-h-[44px]`).
   - Observe live count of students who walked through the school gate today.
2. **Review & Adjust**:
   - Tap large **"Present" (উপস্থিত)**, **"Late" (দেরিতে এসেছে)**, or **"Leave" (ছুটি)** buttons on any student row.
   - Touch targets are large and provide immediate colored badge feedback.
3. **Finish Attendance**:
   - Tap **"Finish Attendance for Today" (উপস্থিতি শেষ করুন)**.
   - Read plain modal warning: Unmarked students will be marked Absent.
   - Tap confirm: Success toast appears ("Attendance saved on server" or "Saved on mobile").

### Script 2: Gate Operator Badges & Problem Cards (গেট ও ব্যাজ পরিচালনা)
1. **Monitor Gate Arrivals**:
   - View live stream of student check-ins with Bengali/English timestamps.
2. **Inspect Scan Issues**:
   - Open **"Gate Problems" (গেটের সমস্যা)**.
   - See plain-language reasons: "Unregistered Badge" (অচেনা ব্যাজ) or "Repeated Scan" (একই ব্যাজ একাধিকবার স্ক্যান হয়েছে).
   - Tap **"Give Badge" (ব্যাজ দিন)** directly from the issue row to assign a new badge.
3. **Manage Student Badges**:
   - Temporarily stop or reactivate badges with accessible confirmation dialogs.

### Script 3: Headmaster Staff & Class Management (বিদ্যালয় প্রশাসন)
1. **School Staff**:
   - View authorized teachers and staff without raw database IDs.
   - Add new staff with full name, 10-digit mobile number, role dropdown, and temporary password.
   - Stop or restore access with single-tap confirmation dialogs.
2. **Attendance Roll Adjustments**:
   - Inspect daily class attendance.
   - Make audit corrections with mandatory plain-language reason.
   - Review clear before/after comparison modal before applying.

### Script 4: District Officer & Headmaster Reports (সরকারি রিপোর্ট ও খাতা)
1. **Daily Roll Sheet**:
   - View class attendance percentage, absentees, and Mid-Day Meal (মিড-ডে মিল) headcounts.
   - Tap **"Print Sheet" (প্রিন্ট করুন)** or **"Export CSV" (সিএসভি ডাউনলোড)**.
2. **Monthly Government Registers**:
   - Open **"Download Official Reports" (সরকারি রিপোর্ট ডাউনলোড)**.
   - Select Class, Month, and Year with large dropdowns.
   - Tap **"Download Excel File" (এক্সেল ফাইল ডাউনলোড করুন)** for UDISE+ and Banglar Shiksha compliant sheets.

---

## 4. Automated Verification Summary
- **Guardrail Test**: `npm run check:guardrail` (0 forbidden strings across 169 source files).
- **Unit & Usability Test Suites**:
  - `tests/i18nCompleteness.test.ts` (100% key parity between `en` and `bn`).
  - `tests/plainLanguageAndErrors.test.ts` (User-safe error & RFID code translations).
  - `tests/noFakeDataGuardrail.test.ts` (Zero fake statistics in production views).
  - `tests/a11yAndMobileUx.test.tsx` (Accessible touch heights $\ge 44\text{px}$).
- **TypeScript Typecheck**: `npm run lint` (`tsc --noEmit`) $\to$ 0 errors.
- **Production Build**: `npm run build` $\to$ clean bundle generation.
