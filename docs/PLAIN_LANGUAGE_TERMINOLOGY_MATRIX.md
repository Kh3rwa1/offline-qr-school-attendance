# Plain-Language Terminology Matrix

This document defines the strict, plain-language terminology standards for all non-super-admin dashboards across the AttendEase platform. Default interfaces must never expose raw database concepts, cryptographic primitives, or low-level protocol names to rural West Bengal school teachers, administrators, gate operators, or report viewers.

## 1. Domain Terminology Mapping

| Internal / Technical Concept | English User-Facing (Class 6 Reading Level) | Bengali User-Facing (বাংলা) | Rationale & Context |
| :--- | :--- | :--- | :--- |
| **IndexedDB / SQLite local table** | Saved on this mobile | এই ফোনে সংরক্ষিত | Teachers do not know browser database names. Focus on the benefit (data is safe on this device). |
| **Offline Synchronization Ledger** | Saved Attendance | সংরক্ষিত উপস্থিতি | Abstract database outbox into tangible school attendance records. |
| **Monotonic Counter / Client Event ID** | Attendance Record ID / Time Recorded | উপস্থিতির সময় | Internal UUIDs and counters confuse non-technical users. Replace with localized time and student name. |
| **Replay Protection / Cryptographic Digest** | Protected student records | সুরক্ষিত তথ্য | Security guarantees expressed as safety reassurance rather than math terms. |
| **HMAC SHA-256 Seal / Auditor Stream** | Official Reports | অফিসিয়াল রিপোর্ট | Government compliance expressed simply as official school records. |
| **RFID EPC / Tag UID** | Student Badge Code | ব্যাজ কোড / শিক্ষার্থীর ব্যাজ | Gate cards are badges given to students for daily tap-in. |
| **Reader Device Provisioning / Fixed Gateway** | School Gate Box / Device | গেট ডিভাইস / গেট বক্স | Clear physical metaphor for hardware installed at school entrance. |
| **Pending Outbox Push** | Send Saved Attendance | সংরক্ষিত উপস্থিতি পাঠান | Clear, actionable verb that indicates uploading queued marks to the cloud. |
| **Session Finalization / Lock State** | Finish Attendance | উপস্থিতি সম্পন্ন করুন | Familiar classroom routine ("attendance is finished for today"). |
| **Chronic Absenteeism Flagging** | Frequently Absent | অনিয়মিত শিক্ষার্থী | Plain educational term understood by Headmasters and teachers alike. |
| **Mid-Day Meal Headcount** | Mid-Day Meal Count | মিড-ডে মিল সংখ্যা | Primary statutory daily requirement for West Bengal government schools. |

---

## 2. Status Badge Terminology Matrix

| System State | English Status Badge | Bengali Status Badge | Visual Treatment |
| :--- | :--- | :--- | :--- |
| `PRESENT` | Present | উপস্থিত | Green chip (`bg-success-50 text-forest-700`) |
| `LATE` | Late | দেরিতে উপস্থিত | Amber chip (`bg-amber-50 text-amber-800`) |
| `ABSENT` | Absent | অনুপস্থিত | Red chip (`bg-danger-50 text-danger-800`) |
| `EXCUSED` / `LEAVE` | On Leave | ছুটিতে | Soft slate chip (`bg-surface-soft text-ink-soft`) |
| `ACTIVE` (Badge/Device) | Active | সক্রিয় | Green chip (`bg-success-50 text-forest-700`) |
| `SUSPENDED` (Badge/Device) | Stopped | স্থগিত | Amber chip (`bg-warning-50 text-warning-800`) |
| `REVOKED` (Badge/Device) | Cancelled | বাতিল | Red chip (`bg-danger-50 text-danger-800`) |
| `SYNCED` | Sent Successfully | সফলভাবে পাঠানো হয়েছে | Green check chip |
| `SYNCING` | Sending… | পাঠানো হচ্ছে… | Blue progress chip |
| `PENDING` | Waiting to Send | পাঠানোর অপেক্ষায় | Amber clock chip |
| `CONFLICT` | Needs Review | যাচাই প্রয়োজন | Amber alert chip |
| `FAILED` | Could Not Send | পাঠানো যায়নি | Red alert chip with friendly error |

---

## 3. Error Translation Protocol

All backend errors (`FOREIGN_KEY_VIOLATION`, `NETWORK_TIMEOUT`, `INVALID_CREDENTIALS`, etc.) must pass through `getUserSafeError(err, language)`:

1. **Network drop**: "No internet connection right now. Your attendance is saved safely on this phone." / "বর্তমানে ইন্টারনেট সংযোগ নেই। আপনার উপস্থিতি এই ফোনে নিরাপদে সংরক্ষিত আছে।"
2. **Session expired**: "Your session has ended. Please log in again to continue." / "আপনার সেশনের সময় শেষ হয়েছে। পুনরায় লগ ইন করুন।"
3. **Card already assigned**: "This badge is already assigned to another student." / "এই ব্যাজটি ইতিমধ্যে অন্য শিক্ষার্থীর নামে যুক্ত আছে।"
4. **Duplicate mark**: "Attendance has already been marked for this student today." / "এই শিক্ষার্থীর উপস্থিতি আজকের জন্য ইতিমধ্যে গৃহীত হয়েছে।"
