# Mobile Responsive Audit (360px Viewport — ₹10,000 Android Devices)

This audit documents testing and responsive design accommodations for low-cost Android smartphones commonly used by teachers and school staff across rural and semi-urban West Bengal.

## 1. Target Hardware & Viewport Baseline

- **Device Class**: Budget Android Smartphone (e.g. Redmi 9A / Realme C-series / Samsung Galaxy M04, ~₹7,000–₹10,000 INR).
- **Viewport Dimensions**: $360\text{px} \times 640\text{px}$ (CSS viewport), 100% display scaling.
- **Network Profile**: 2G/3G intermittent connection, periodic complete network blackouts.
- **Input Method**: Single-finger touch input, virtual keyboard occupying ~50% vertical space on focus.

---

## 2. Key UX Adaptations for 360px Devices

1. **No Horizontal Scroll Overflows**:
   - All layout containers use responsive grid/flex columns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
   - Tables automatically convert to stacked mobile card layouts on viewports $<768\text{px}$ (e.g., `OfflineWorkspace.tsx`, `ReaderManagement.tsx`).
2. **Thumb-Zone Navigation**:
   - Mobile bottom bar (`MobileNavigation.tsx`) positions the 4 most critical role actions within natural one-handed thumb reach.
   - Touch targets $\ge 48\text{px}$ height with adequate spacing to prevent mistaps.
3. **Modal & Dialog Scaling**:
   - Modals use `max-w-md w-full p-4 sm:p-6` with scrollable inner bodies (`max-h-[85vh] overflow-y-auto`) so virtual keyboards do not obscure confirmation buttons.
4. **Touch Target Sizing**:
   - All buttons, selects, and text inputs enforce `min-h-[44px]` height.
5. **Zero Data Loss during Screen Rotations / App Backgrounding**:
   - Active offline attendance states persist in Dexie/IndexedDB local outbox across browser reloads or Android memory pressure events.
