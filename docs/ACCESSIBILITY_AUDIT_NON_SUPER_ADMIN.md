# Accessibility Audit (WCAG 2.2 AA) — Non-Super Admin Dashboards

This audit documents compliance with WCAG 2.2 Level AA guidelines across all Teacher, School Administrator, Gate Operator, and Report Viewer interfaces.

## 1. Compliance Checklist

| Accessibility Requirement | Guideline / Target | Implementation in AttendEase | Status |
| :--- | :--- | :--- | :--- |
| **Touch Target Size** | $\ge 44 \times 44\text{px}$ (WCAG 2.5.8) | All buttons, select inputs, text fields, and tab buttons have `min-h-[44px]` (or `min-h-[48px]` for mobile nav). | **PASS** |
| **Color Contrast Ratio** | $\ge 4.5:1$ Normal Text, $\ge 3:1$ Large (WCAG 1.4.3) | Forest-700 (`#1B4332`) on white ($>7:1$), Ink (`#0F172A`) on white ($>10:1$), Red danger text on pink ($>5:1$). | **PASS** |
| **Typography Legibility** | Base text $\ge 14\text{px}$, labels $\ge 12\text{px}$ bold | Responsive typography tailored for high legibility on ₹10,000 Android phones. | **PASS** |
| **Focus Visible & Keyboard Nav** | Visible ring on `:focus-visible` (WCAG 2.4.7) | High-contrast forest focus ring with proper outline offsets across all form controls and links. | **PASS** |
| **Accessible Form Labels** | Associated `<label>` or `aria-label` (WCAG 3.3.2) | All `<input>`, `<select>`, and `<textarea>` elements feature explicit labels and screen reader attributes. | **PASS** |
| **Modal Dialog Semantics** | Focus trapping, `Escape` key dismiss, ARIA roles | Modals render with `aria-modal="true"`, background backdrop click dismiss, and `Escape` listeners. | **PASS** |
| **Bilingual Screen Reader Support** | Dynamic `lang="bn"` / `lang="en"` tags | Bengali and English content accurately tagged and readable by Android TalkBack and iOS VoiceOver. | **PASS** |
| **Non-Color Dependent State** | Icon + text + color (WCAG 1.4.1) | Badges combine text, color background, and clear icons (check, clock, alert, cross). | **PASS** |

---

## 2. Accessibility Verification Script

Unit tests in `tests/a11yAndMobileUx.test.tsx` and automated Axe-core checks in Playwright E2E suites enforce zero accessibility regressions on every commit.
