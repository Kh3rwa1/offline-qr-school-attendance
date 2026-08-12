# PWA QR Attendance - Pilot Launch Guides & Checklists

This operational workbook contains guides, fallback playbooks, and checklists designed for school staff, teachers, administrators, and coordinators supporting the local pilot rollout.

---

## 1. Rollback & Failover Procedures

### 1.1 Pilot Rollback Playbook
If critical infrastructure (such as server hosting or regional electricity networks) experiences a complete and sustained outage, the school will trigger a localized rollback:
1. **Fallback to Paper Registers**: Teachers immediately switch to the standard paper attendance register book.
2. **Offline Local Buffering**: If the PWA is active but the server is down, teachers can continue scanning student QR cards offline. All logs buffer locally in the IndexedDB outbox.
3. **Delayed Synchronization**: As soon as connection is recovered, teachers tap the **Sync Outbox** button to upload all buffered records in a single batch.

---

## 2. Incident-Response Guide

| Event / Issue | Primary Diagnosis | Direct Corrective Action |
| :--- | :--- | :--- |
| **PWA Scanner Freeze** | Camera permission revoked or system process lock. | Tap "Refresh Camera" button or reboot browser tab. |
| **Sync Handshake Blocked** | Invalid auth token or device blacklisted on server. | Log out, log in again on an active network to refresh security token. |
| **Guardian SMS Fails** | Gateway API credentials expired or DLT template violation. | Access Admin Console -> SMS Status, check provider logs, re-test template code. |
| **High Scan Reject Rate** | Poor contrast on printed cards or low ambient classroom lighting. | Adjust brightness, utilize external scanner attachment, or manually override from roster list. |

---

## 3. School Admin Guide

The **School Admin Dashboard** empowers principals and system operators to govern school rosters:
* **Roster Management**: Administrators can import rosters from standard Banglar Shiksha XLSX files, edit student records, and assign teachers to specific classroom sections.
* **Credential Enrollment & Revocation**: Generate and print robust student QR identification badges. If a card is reported lost, revoke the credential instantly from the Admin UI to prevent duplicate scan fraud.
* **Audit Analytics**: Access secure, system-wide transaction history logs to review attendance overrides, manual adjustments, and notification queue dispatch outcomes.

---

## 4. Teacher Quick-Start Guide (English)

### Step 1: Login & Setup
1. Open the application URL on your mobile browser (Safari, Chrome, or Firefox).
2. Tap the **Install App** button to bookmark the PWA on your home screen.
3. Enter your authorized school phone number and secure login password.

### Step 2: Roster Synchronization
1. Under **Available Classes**, select your assigned class (e.g., Class VIII-A).
2. Tap the **Download Roster** button to download student records and QR credentials.
3. Observe the network indicator changing to **ONLINE (Green)**. You are now prepared to go offline!

### Step 3: Daily Offline Attendance Register
1. When entering the classroom, launch the scanner interface.
2. Direct the mobile camera towards the student's printed QR card.
3. System plays an audio beep and flashes a green card confirmation with the student's name and roll number.
4. **Duplicate Safeguard**: If you scan a card again, the system displays a warning and ignores the transaction.

### Step 4: Finalization
1. Switch the class status from **OPEN** to **REVIEW** to inspect missing student lists.
2. Mark remaining students as **ABSENT** or override statuses if required.
3. Tap **Finalize Attendance**. All absence notification SMS messages are generated automatically on the backend.

---

## 5. শিক্ষক নির্দেশিকা (Bengali Teacher Quick-Start)

### ধাপ ১: লগইন এবং হোম স্ক্রিনে যুক্ত করুন
১. আপনার মোবাইলের ব্রাউজার থেকে স্কুলের নির্দিষ্ট ইউআরএল (URL) ঠিকানায় প্রবেশ করুন।
২. স্ক্রিনে প্রদর্শিত **অ্যাপ ইনস্টল করুন** বাটনে চাপ দিয়ে অ্যাপটি মোবাইলের হোম স্ক্রিনে যুক্ত করুন।
৩. আপনার স্কুল থেকে দেওয়া মোবাইল নম্বর এবং পাসওয়ার্ড দিয়ে লগইন করুন।

### ধাপ ২: ছাত্র-ছাত্রীদের তালিকা ডাউনলোড করুন
১. আপনার নির্ধারিত ক্লাস (যেমন: অষ্টম শ্রেণী-ক) নির্বাচন করুন।
২. ** তালিকা ডাউনলোড করুন** বাটনে চাপ দিয়ে ইন্টারনেট সংযোগ থাকা অবস্থায় ছাত্র-ছাত্রী ও কিউআর (QR) কোডের তথ্য আপনার মোবাইলে সেভ করে নিন।
৩. মোবাইল স্ক্রিনে **অনলাইন (সবুজ)** লেখাটি দেখে নিশ্চিত হন। এরপর ইন্টারনেট বন্ধ থাকলেও অ্যাপটি কাজ করবে।

### ধাপ ৩: অফলাইন কিউআর (QR) কোড স্ক্যানিং
১. শ্রেণীকক্ষে প্রবেশ করে স্ক্যানার স্ক্রিনটি চালু করুন।
২. ছাত্র-ছাত্রীদের আইডি কার্ডে থাকা কিউআর (QR) কোডটি মোবাইলের ক্যামেরার সামনে ধরুন।
৩. কোডটি সঠিক হলে মোবাইলে একটি শব্দ (Beep) হবে এবং ছাত্র-ছাত্রীর ছবি ও নাম স্ক্রিনে দেখা যাবে।
৪. **ভুল সংশোধন**: একই শিক্ষার্থীর কার্ড পুনরায় স্ক্যান করা হলে অ্যাপটি সতর্কবার্তা দেবে এবং নতুন এন্ট্রি গ্রহণ করবে না।

### ধাপ ৪: ক্লাসের উপস্থিতি সমাপ্তিকরণ
১. ক্লাসের সকল শিক্ষার্থীর স্ক্যান শেষ হলে স্ট্যাটাসটি **রিভিউ** (Review)-তে পরিবর্তন করুন এবং অনুপস্থিত শিক্ষার্থীদের তালিকা পরীক্ষা করুন।
২. অনুপস্থিত শিক্ষার্থীদের চূড়ান্ত তালিকা নিশ্চিত করুন এবং **উপস্থিতি সমাপ্ত করুন** বাটনে চাপ দিন।
৩. উপস্থিতি চূড়ান্ত হওয়ার সাথে সাথে অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের কাছে স্বয়ংক্রিয়ভাবে অনুপস্থিতি বার্তা (SMS) চলে যাবে।

---

## 6. Official Pilot Readiness Checklist

- [ ] **Infrastructure**: Docker containers launched successfully on production node.
- [ ] **Security Protocol**: HSTS, secure CSP, rate limiting, and HttpOnly cookies enabled.
- [ ] **Roster Seeding**: 2 pilot schools with 1,400+ students and 60 teachers fully seeded.
- [ ] **Credential Integrity**: QR digests generated for all student profiles.
- [ ] **Local Storage**: IndexedDB database initialized and responsive on mobile browsers.
- [ ] **Teacher Prep**: English and Bengali user guides distributed to target instructors.
- [ ] **Backup**: Nightly AES-256 encrypted backups scheduled to secure off-site archive.
