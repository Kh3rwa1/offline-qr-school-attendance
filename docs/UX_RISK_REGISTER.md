# UX Risk Register — Rural School Operations

This risk register identifies usability, cognitive, and hardware constraints in rural West Bengal schools and details the mitigations implemented in AttendEase.

## 1. Identified Risks & Mitigations

| Risk ID | Description & Context | Impact / Severity | Implemented Mitigation in AttendEase | Status |
| :--- | :--- | :--- | :--- | :--- |
| **UX-R1** | **Unfamiliarity with English technical terms**: Older teachers may abandon attendance if presented with terms like "IndexedDB" or "Replay Attack". | Critical | Replaced all system jargon with natural classroom terms ("Saved on this phone", "Protected records"). Complete Bengali localization. | **MITIGATED** |
| **UX-R2** | **Accidental card revocation / loss**: Staff might click "Revoke" unintentionally when intending to temporarily disable a lost card. | High | Implemented two-tier status ("Stopped" for temporary, "Cancelled" for permanent) with explicit confirmation modals. | **MITIGATED** |
| **UX-R3** | **Unfinished attendance marked absent**: Teachers might accidentally click "Finish Attendance" while some students are still arriving. | High | Modal confirmation explicitly warns: "All unmarked students will be marked Absent. You can make adjustments anytime." | **MITIGATED** |
| **UX-R4** | **Small touch targets on low-cost Android screens**: Budget ₹10,000 phones have less responsive digitizers, causing frustrating mistaps. | Medium | Enforced strict `min-h-[44px]` (and `min-h-[48px]` for navigation) touch target minimums with generous padding across all controls. | **MITIGATED** |
| **UX-R5** | **Misleading mock data in government reports**: Auditor or district official confused by hardcoded fallback percentages. | Critical | Completely removed all static mock metrics. Truthful empty states rendered when attendance sessions have not yet occurred. | **MITIGATED** |
| **UX-R6** | **Network drop during attendance sync**: Teacher fears data is lost when connection drops during submission. | High | Prominent status badge informs: "No internet — your attendance is safe on this device." Automatic retry upon reconnection. | **MITIGATED** |
| **UX-R7** | **Virtual keyboard obscuring form actions**: On small 360px viewports, the onscreen keyboard covers submit buttons. | Medium | Scrollable modal bodies with auto-scrolling to active fields, ensuring buttons remain visible. | **MITIGATED** |
