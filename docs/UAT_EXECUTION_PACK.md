# User Acceptance Testing (UAT) Protocol & Field Execution Pack

> **PROJECT**: AttendEase — Offline QR + RFID School Attendance Platform  
> **STATUS**: **PENDING INDEPENDENT HUMAN FIELD VERIFICATION**  
> **INTENDED AUDIENCE**: School Pilots, District Field Teams, Accessibility Evaluators

---

## 1. Objective & Scope

This test pack establishes the formal evaluation protocol for field trials of AttendEase in rural and semi-urban school environments across West Bengal. 

The protocol validates:
1. **Offline Classroom Attendance**: Reliability during continuous power or cellular data blackouts.
2. **Bengalish Language Ergonomics**: Clarity and ease of use for non-technical teachers and gate staff.
3. **Accessibility**: One-handed mobile operation, $\ge 44 \times 44\text{px}$ touch targets on compact devices (360px–390px screens), and screen-reader navigable reports.
4. **Data Integrity**: Local Dexie IndexedDB storage, compound tenant isolation, and conflict-free cloud synchronization.

---

## 2. Participant Inclusion Criteria & Cohorts

| Cohort | Target Role | Age & Experience Profile | Device / Environment Profile |
| :--- | :--- | :--- | :--- |
| **Cohort 1** | Senior Classroom Teacher | 50+ yrs, non-tech-native, Bengali primary | 360px screen (Android 10/11), low sunlight / outdoor |
| **Cohort 2** | Junior Teacher | 22–35 yrs, tech-familiar, bilingual | 390px screen (Android 13/14), standard classroom |
| **Cohort 3** | Headmaster / School Admin | Experienced administrator | Desktop / Laptop (Chrome / Firefox) |
| **Cohort 4** | Gate / Security Operator | Entry-level staff, fast scan focus | Dedicated 360px handheld / Tablet |
| **Cohort 5** | District Report Viewer | Administrative oversight | Tablet / Desktop (1280px+) |

---

## 3. Informed Consent & Privacy Instructions

### Anonymization Protocol
- No student full names, photographs, or personal biometric details are stored in raw logs.
- All evaluation sessions record only Participant ID (`P01`, `P02`, etc.) and system telemetry.
- Audio/video recordings (if captured with consent) must be stored in encrypted local storage and retained for maximum 30 days.

### Consent Template (বাংলা ও ইংরেজি)
```text
I voluntarily agree to participate in the AttendEase usability evaluation session.
I understand that my feedback will be used to improve school attendance software.
No personal identification information will be publicly disclosed.

আমি স্বেচ্ছায় AttendEase মূল্যায়ন প্রক্রিয়ায় অংশগ্রহণ করতে সম্মত হচ্ছি।
আমার মতামত শুধুমাত্র সফটওয়্যার উন্নতির জন্য ব্যবহৃত হবে।

Participant ID: _______________    Date: _______________
Signature / নাম স্বাক্ষর: ________________________________
```

---

## 4. Bengali-Language Task Scripts

### Task 1: শ্রেণিকক্ষে অফলাইন হাজিরা (Offline Classroom Roll Call)
> **প্রশিক্ষক নির্দেশিকা**: শিক্ষককে মোবাইল দিন এবং অফলাইন মোড চালু করুন।
> **কাজের বিবরণ**:
> ১. আপনার নির্ধারিত শ্রেণি (যেমন Class 5-A) নির্বাচন করুন।
> ২. ক্যামেরা স্ক্যানার দিয়ে উপস্থিত শিক্ষার্থীদের কিউআর কোড স্ক্যান করুন।
> ৩. যারা কিউআর কার্ড আনেনি তাদের নামের পাশে "উপস্থিত" / "দেরি" বোতাম চাপুন।
> ৪. "হাজিরা শেষ করুন" বোতাম চেপে সম্পন্ন করুন।

### Task 2: নতুন কর্মী যুক্তকরণ (Add Staff Member)
> **কাজের বিবরণ**:
> ১. বিদ্যালয় প্রশাসন (School Admin) পোর্টালে লগইন করুন।
> ২. "কর্মী ও ভূমিকা" মেনুতে প্রবেশ করুন।
> ৩. "নতুন কর্মী" বোতাম চাপুন এবং নাম, ফোন ও ভূমিকা নির্বাচন করে সাবমিট করুন।
> ৪. পাসওয়ার্ড ফিল্ডের চোখ আইকন (Eye icon) স্পর্শ করে দৃশ্যমানতা যাচাই করুন।

### Task 3: গেট অপারেটর স্ক্যানিং (Gate Scanning)
> **কাজের বিবরণ**:
> ১. গেট অপারেটর পোর্টালে প্রবেশ করুন।
> ২. আগমন তালিকায় শিক্ষার্থীর নাম ও সময় যাচাই করুন।
> ৩. অজানা কার্ড স্ক্যানের ক্ষেত্রে সতর্কতা বার্তা লক্ষ্য করুন।

---

## 5. System Usability Scale (SUS) Questionnaire

Each item is scored from 1 (Strongly Disagree / দৃঢ়ভাবে অসম্মত) to 5 (Strongly Agree / দৃঢ়ভাবে সম্মত):

1. I think that I would like to use this system frequently.  
   *(আমি প্রতিনিয়ত এই সিস্টেমটি ব্যবহার করতে আগ্রহী।)*
2. I found the system unnecessarily complex.  
   *(সিস্টেমটি অপ্রয়োজনীয়ভাবে জটিল মনে হয়েছে।)*
3. I thought the system was easy to use.  
   *(সিস্টেমটি ব্যবহার করা অত্যন্ত সহজ ছিল।)*
4. I think that I would need the support of a technical person to be able to use this system.  
   *(এটি ব্যবহারের জন্য কারিগরি সহায়তার প্রয়োজন হবে।)*
5. I found the various functions in this system were well integrated.  
   *(সিস্টেমের বিভিন্ন ফিচারগুলো সুসংগঠিত।)*
6. I thought there was too much inconsistency in this system.  
   *(সিস্টেমটিতে অসঙ্গতি বেশি ছিল।)*
7. I would imagine that most people would learn to use this system very quickly.  
   *(অধিকাংশ শিক্ষক খুব দ্রুত এটি শিখে নিতে পারবেন।)*
8. I found the system very cumbersome to use.  
   *(সিস্টেমটি ব্যবহার করা কষ্টসাধ্য ছিল।)*
9. I felt very confident using the system.  
   *(সিস্টেমটি ব্যবহারের সময় আমি আত্মবিশ্বাসী অনুভব করেছি।)*
10. I needed to learn a lot of things before I could get going with this system.  
    *(এটি ব্যবহারের আগে অনেক কিছু শেখার প্রয়োজন ছিল।)*

$$\text{SUS Score} = \left[ \sum (\text{Odd items} - 1) + \sum (5 - \text{Even items}) \right] \times 2.5$$

---

## 6. Issue Severity & Defect Rubric

| Severity Level | Definition | Field Action |
| :--- | :--- | :--- |
| **Critical (P0)** | Data loss, cross-school data leak, unhandled app crash, sync failure | Release blocker; immediate patch required |
| **Major (P1)** | Touch target $< 44\text{px}$, confusing translation, missing offline button | Must fix before district pilot expansion |
| **Moderate (P2)** | Minor color contrast issue, slow list rendering with $>1000$ rows | Optimize in next sprint |
| **Minor (P3)** | Cosmetic spacing or minor wording enhancement | Backlog enhancement |

---

## 7. Sign-off & Audit Status

```text
================================================================================
UAT STATUS: PENDING INDEPENDENT HUMAN FIELD VERIFICATION
================================================================================
Automated Test Coverage:        100% (71 Vitest suites, 16 CI checks green)
Playwright E2E Verification:    Touch-targets, Axe, Keyboard, Reflow, Bengali
Field Pilot Status:             READY FOR ON-SITE DEPLOYMENT & EVALUATION
================================================================================
```
