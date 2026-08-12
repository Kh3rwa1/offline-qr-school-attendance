# System Architecture Specification

## 1. High-Level Architectural Pattern

The application is structured as a **Modular Monolith** designed for high developer velocity, operational simplicity, and deployment on low-cost VPS instances. It cleanly separates concerns without introducing the operational overhead of microservices, Redis, or Kubernetes.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT SIDE (PWA)                                 |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  |  React 19 / Vite   |   | Camera Scan Engine  |   | USB Keyboard Wedge       |  |
|  |  UI (Tailwind CSS) |   | (zxing/BarcodeDet.) |   | Buffer Service           |  |
|  +---------+----------+   +----------+----------+   +------------+-------------+  |
|            |                         |                       |                    |
|            +-------------------------+-----------------------+                    |
|                                      |                                            |
|                        +-------------v-------------+                              |
|                        | Dexie.js (IndexedDB)      |                              |
|                        | Local Storage & Outbox    |                              |
|                        +-------------+-------------+                              |
|                                      |                                            |
|                        +-------------v-------------+                              |
|                        | Service Worker (Serwist)  |                              |
|                        | Cache & Background Sync   |                              |
|                        +-------------+-------------+                              |
+--------------------------------------|--------------------------------------------+
                                       | HTTPS / JSON Sync Payload
                                       v
+-----------------------------------------------------------------------------------+
|                               SERVER SIDE (Node.js)                               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Caddy / Nginx Reverse Proxy (SSL Termination, Rate Limiting)                |  |
|  +-----------------------------------+-----------------------------------------+  |
|                                      |                                            |
|  +-----------------------------------v-----------------------------------------+  |
|  | Express / Web API Service                                                   |  |
|  |  - Auth & Session Verification (Argon2id, Secure Cookies)                     |  |
|  |  - Tenant Authorization Middleware                                          |  |
|  |  - Idempotent Sync Handler                                                  |  |
|  |  - Domain Application Services                                              |  |
|  +-----------------------------------+-----------------------------------------+  |
|                                      |                                            |
|  +-----------------------------------v-----------------------------------------+  |
|  | Background Worker Process (pg-boss or Postgres DB Queue)                    |  |
|  |  - Attendance Finalization Listener                                         |  |
|  |  - SMS Notification Job Runner                                              |  |
|  |  - XLSX Bulk Import Processor                                               |  |
|  +-----------------------------------+-----------------------------------------+  |
|                                      |                                            |
|  +-----------------------------------v-----------------------------------------+  |
|  | PostgreSQL Database (Drizzle ORM)                                           |  |
|  |  - Strict Multi-Tenant Schema (school_id)                                   |  |
|  |  - Row-Level Security (RLS) Policies                                        |  |
|  |  - Append-Only Event Stream & Projections                                   |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown & Responsibilities

### Client Application (PWA Layer)
- **UI Framework:** React 19, Vite, Tailwind CSS v4, Lucide React icons, Motion animations.
- **Offline Storage Engine:** Dexie.js abstraction over IndexedDB for zero-latency local scans and durable event queuing.
- **Scanning Engine:** Dual-input processor supporting live video camera stream (BarcodeDetector API with `@zxing/browser` fallback) and USB 2D hardware barcode scanners (rapid keystroke buffer).
- **Service Worker:** Built with Serwist (Workbox-based) to cache static application assets, app shell, and runtime API fallbacks.

### Web API Gateway & Services
- **Framework:** Express / Node.js running under `tsx` in development and bundled `esbuild` CommonJS in production.
- **Authentication & Sessions:** Database-backed auth sessions (`auth_sessions`), Argon2id password hashing, HTTP-only SameSite cookies.
- **Tenant Isolation:** Enforced via `school_id` checks in service layers and backed by PostgreSQL Row-Level Security (RLS).
- **Sync Engine:** Processes client batch submissions (`POST /api/v1/sync/attendance-events`), enforces idempotency using `client_event_id`, and resolves attendance projections.

### Background Job Worker Process
- **Queue Implementation:** `pg-boss` or PostgreSQL-backed job table using transactional locking (`FOR UPDATE SKIP LOCKED`).
- **SMS Job Processor:** Consumes `FINALIZED` attendance sessions, generates localized message payloads (English/Bengali), handles provider abstraction retries with exponential backoff.
- **Import/Export Engine:** Staged XLSX parsing and transactional student enrollment creation using `ExcelJS`.

---

## 3. Hardware & Input Interface Layer

### Camera Scanning Subsystem
```
[ Video Feed ] -> [ BarcodeDetector API / @zxing/browser ] -> [ Raw QR String ] 
                                                                    |
                                                                    v
[ Audio/Visual Feedback ] <- [ Update Dexie State ] <- [ SHA-256 Digest Match ]
```

### USB Hardware Scanner Subsystem (Keyboard Wedge)
Hardware 2D USB scanners emulate rapid keyboard typing followed by an `Enter` carriage return (`\n` or `\r`).
- **Buffer Mechanism:** Captures `keydown` events at document level.
- **Keystroke Speed Threshold:** Measures inter-keystroke timing (< 30ms between characters). Characters typed slower than 50ms are identified as manual keyboard input and ignored by the scanner buffer.
- **Termination Handler:** Flushes buffer upon receiving `Enter` key, sends raw string to the unified QR processing engine.

---

## 4. Deployment Topology

The entire system runs on a single low-cost Linux VPS initially using Docker Compose:

1. **Reverse Proxy Container:** Nginx or Caddy terminating TLS 1.3 with automatic Let's Encrypt certificates, gzip compression, and rate limiting (`100 req/min` per IP for standard routes, `10 req/min` for login/sync).
2. **Web Container:** Runs the compiled Next.js / Express web application on port 3000.
3. **Worker Container:** Shares codebase and database connection with Web Container, running the background job processor (`node dist/worker.js`).
4. **PostgreSQL Container:** PostgreSQL 16+ configured with WAL archiving and daily automated backup scripts (`pg_dump` with AES-256 encryption).
