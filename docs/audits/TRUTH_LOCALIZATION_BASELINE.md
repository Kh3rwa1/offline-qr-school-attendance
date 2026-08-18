# Baseline Verification & Audit Record

**Repository**: `https://github.com/Kh3rwa1/offline-qr-school-attendance`  
**Product**: AttendEase OS  
**Starting Main Commit SHA**: `00b7b04404d580628f594890bf2c4c02d323bf61`  
**Target Feature Branch**: `fix/truth-localization-evidence-10of10`  
**Audit Timestamp**: 2026-08-18T20:59:30+05:30  
**Operating Environment**: macOS (Darwin 24.6.0), Node.js v22.22.3, npm 10.9.8  

---

## 1. Starting Baseline Verification Results

Prior to making any modifications, the full verification suite was executed against commit `00b7b04404d580628f594890bf2c4c02d323bf61`:

| Step / Command | Command Executed | Result | Details |
| :--- | :--- | :---: | :--- |
| **Dependency Lockfile** | `npm ci` | **PASS (Exit 0)** | 459 packages installed cleanly |
| **Typecheck & Guardrails** | `npm run check` | **PASS (Exit 0)** | `tsc --noEmit` passed (0 errors); 0 forbidden strings across 191 files; centralized i18n & >=14px passed |
| **Unit & Integration Suite** | `npm test` | **PASS (Exit 0)** | 72 test files passed, 4 skipped (76 total); 418 tests passed, 13 skipped (431 total) |
| **Production Build** | `npm run build` | **PASS (Exit 0)** | Vite client bundle + 5 Node server/worker/gateway bundles compiled cleanly |
| **Playwright Browser E2E** | `npm run test:e2e` | **PASS (Exit 0)** | 228 passed, 20 skipped across Chromium & Firefox matrix (7.8 min) |
| **Business Load Smoke Gate** | `npm run test:load-smoke` | **PASS (Exit 0)** | 13,585 total requests across 10 scenarios; 0 unexpected failures; 0 duplicate records; Post-load DB integrity PASSED |

---

## 2. Identified Blockers & Deficiencies on Baseline

Despite all existing automated tests passing, the following 13 critical gaps and truthful blockers were identified during audit:

1. **Unsupported UDISE+, Government, and DPDP Marketing Claims**:
   - Marketing claims in `src/app/LandingPage.tsx`, `src/app/landingCopy.ts`, and `README.md` state "UDISE+ compliant reports", "Government-ready reports", "Govt standard", and "Protected under India's DPDP law".
   - No external government certification or DPDP legal certification exists in the repository.

2. **Unverified Named Default Testimonials**:
   - `src/app/LandingPage.tsx` displays hardcoded/default testimonials quoting fictionalized individuals ("Ranjit Kumar Das", "Sunita Mahato") and schools ("Khatra High School", "Purulia Zilla School").
   - Violates the Critical Truth Policy.

3. **Contradictory Hardware Validation Documentation**:
   - `docs/STATUS.md` states physical Zebra FX9600 validation is pending.
   - `docs/FX9600_HARDWARE_ACCEPTANCE_PACK.md` contained fabricated serial numbers (`FX9600-IND-2026-0814`), measurements, and personal sign-off claiming "CERTIFIED (10/10 Live Hardware Verification Passed)".

4. **Incomplete English / Bengali / Hindi Landing Page Localization**:
   - Hindi translations in `landingCopy.ts` were written in Hinglish rather than authentic Hindi.
   - Hardcoded English strings introduced in PR #74 for pricing, video demo, testimonials, and comparison table.

5. **Dynamic Platform Settings Not Fully Locale-Aware**:
   - Single `hero_subtitle` setting in `platformSettings` table instead of locale-aware keys (`hero_subtitle_en`, `hero_subtitle_bn`, `hero_subtitle_hi`).

6. **Small Typography & Accessibility Gaps**:
   - Sub-14px text classes and language selector text in public landing page.
   - Axe Playwright test coverage omitted the public landing page, demo dialog, and setup wizard.

7. **Unsupported Comparison Table Performance & Cost Claims**:
   - Comparison table presents unqualified assertions ("Under 2 minutes", "₹80–120 paper cost", "✓ Automatic SMS").
   - Needs conversion to an interactive assumptions calculator with prominent illustrative disclaimers.

8. **Weak YouTube Hostname Validation**:
   - Substring check `hostname.includes('youtu.be')` is vulnerable to domain confusion attacks (`evil-youtu.be`, `youtu.be.attacker.com`).
   - Missing strict exact allowlisting, 11-char ID validation, and CSP `frame-src https://www.youtube-nocookie.com`.

9. **Relaxed CI Performance Thresholds**:
   - Shared CI smoke runner uses relaxed thresholds (p95 2500ms/3500ms) without distinguishing between shared runner limits and controlled production SLOs.

10. **E2E Retry Behavior Concealing Flakiness**:
    - `playwright.config.ts` had `retries: process.env.CI ? 1 : 0`, which concealed flaky tests.

11. **Missing External Validation Register & Tracking**:
    - No central tracking register for pending external dependencies (teacher UAT, DLT SMS, physical FX9600 commissioning, legal review, VAPT, government report acceptance).

12. **Node.js 20 GitHub Actions Runtime Warnings**:
    - GitHub Actions in `.github/workflows/` need pin updates and action version alignment.

13. **Internal Documentation Self-Awarding 10/10**:
    - `docs/INDEPENDENT_AUDIT_REPORT.md` is an internal report that self-awarded independent scores.
