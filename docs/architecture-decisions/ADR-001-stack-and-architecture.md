# ADR-001: Technology Stack and Modular Monolith Architecture

* **Status:** Approved
* **Date:** 2026-08-11
* **Context:** The system must run reliably in low-resource environments (rural West Bengal government schools) on low-cost VPS infrastructure while serving low-end Android mobile devices.

## Decision
We adopt a **Modular Monolith** architecture deployed via Docker Compose on a single Linux VPS instance.

### Technology Stack Choices
1. **Frontend PWA:** React 19 + Vite + Tailwind CSS v4 + Serwist PWA + Dexie.js (IndexedDB).
2. **Backend Engine:** Express / Node.js running TypeScript, bundled using `esbuild` to CommonJS in production.
3. **Database:** PostgreSQL 16+ accessed via Drizzle ORM.
4. **Offline Scanner:** Camera scanning via BarcodeDetector API with `@zxing/browser` fallback, combined with document-level keyboard wedge buffering for USB 2D hardware barcode scanners.
5. **Background Jobs:** PostgreSQL-backed background worker process (`pg-boss` or custom DB queue using `FOR UPDATE SKIP LOCKED`).

## Consequences
* **Positives:** Simple deployment model, low operational cost, fast zero-network IPC within single VPS, eliminated microservice distribution complexity.
* **Negatives:** Monolithic process requires strict modular boundary enforcement in code structure (`packages/database`, `packages/domain`, `packages/ui`).
