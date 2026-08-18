# AttendEase OS — Human Assistive Technology Validation Plan

> **Document Status**: `ENGINEERING_SPECIFICATION`  
> **Human UAT Certification Status**: `EXTERNALLY_PENDING`  
> **Automated WCAG 2.2 AA Status**: `AUTOMATION_VERIFIED` (Axe-core Playwright E2E Suite)

---

## 1. Objective & Scope

While automated accessibility scanning via `@axe-core/playwright` verifies structural WCAG 2.1 / 2.2 Level AA compliance (color contrast, landmark roles, accessible names, keyboard focusability, touch target dimensions $\ge 44\times 44\text{px}$, reflow at 400% zoom), formal accessibility validation requires human user acceptance testing (UAT) using screen reader assistive technologies.

This plan defines the formal protocol for human testing across three primary platforms:
1. **TalkBack** (Android 13/14 on standard smartphone browsers: Google Chrome / Android System WebView)
2. **VoiceOver** (iOS 17/18 on Mobile Safari)
3. **NVDA / JAWS** (Windows 11 on Google Chrome / Mozilla Firefox)

---

## 2. Testing Scenarios & Evaluation Rubric

| Test Scenario | Assistive Tool | User Action & Expected Experience | Status |
| :--- | :--- | :--- | :---: |
| **H-A11Y-01: Public Landing Page Navigation** | TalkBack / VoiceOver | User activates Skip-to-Content link; navigates through hero, capabilities, and 8 onboarding steps; language switcher announces active state clearly. | `EXTERNALLY_PENDING` |
| **H-A11Y-02: Public Demo Request Dialog** | TalkBack / VoiceOver | User opens demo dialog; focus traps inside modal; form labels, phone formatting, purpose notice, and consent checkbox announce clearly; Escape key restores focus. | `EXTERNALLY_PENDING` |
| **H-A11Y-03: Savings Calculator & Methodology** | NVDA / VoiceOver | Slider announces current value (`studentCount`) and step increments; expandable methodology drawer toggles `aria-expanded` state. | `EXTERNALLY_PENDING` |
| **H-A11Y-04: First-Run Setup Wizard** | NVDA / Chrome | Operator navigates 4-step wizard; form errors, passwords, and progress indicators are audibly announced. | `EXTERNALLY_PENDING` |
| **H-A11Y-05: Teacher Morning Roll Review** | TalkBack / Chrome | Teacher navigates live tap feed and unmarked student list; single-tap status override buttons announce student name, current status, and updated status. | `EXTERNALLY_PENDING` |
| **H-A11Y-06: High Contrast & 400% Zoom Reflow** | Windows High Contrast | All interactive icons, text, and data tables remain distinct and reflow to a single vertical column without horizontal scroll. | `EXTERNALLY_PENDING` |

---

## 3. Evaluator Qualifications & Participant Criteria

1. **Participants**: Minimum 3 independent testers who rely on assistive screen readers for daily computer/smartphone use.
2. **Linguistic Proficiency**: Testers with primary languages in English, Bengali (বাংলা), and Hindi (हिंदी).
3. **Hardware**: Standard low-to-mid range Android devices (e.g. Redmi, Samsung Galaxy A-series) and Windows laptops.

---

## 4. Promotion Criteria to EXTERNALLY_VALIDATED

To elevate human accessibility status from `EXTERNALLY_PENDING` to `EXTERNALLY_VALIDATED`:
1. Submit signed evaluation transcripts from all 3 certified evaluators.
2. Resolve any reported severity 1 or severity 2 screen reader blocking issues.
3. Record evaluator credentials and test dates in [`docs/audits/EXTERNAL_VALIDATION_REGISTER.md`](EXTERNAL_VALIDATION_REGISTER.md).
