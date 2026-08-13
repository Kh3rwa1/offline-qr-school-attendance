# RFID System Architecture

## Overview
This document outlines the architecture for the dual-mode QR and RFID/NFC attendance system. The architecture is designed to support both existing QR-based attendance and new high-security RFID/NFC card scanning.

## Component Diagram
- **RFID Readers:** Hardware devices capturing card taps.
- **Reader Gateway:** On-premise service (usually near readers) that interfaces with readers, queues events, and forwards them to the server.
- **Backend Server:** Express.js + TypeScript service managing business logic.
- **PostgreSQL Database:** Primary datastore with RLS enforcing tenant boundaries.
- **Redis (ioredis):** Handles rate limiting, duplicate tap prevention, and nonce caching.

## Scan Processing Pipeline (15 Steps)
1. **Card Tap:** Reader detects card.
2. **Mutual Authentication:** Reader and card authenticate (SECURE mode).
3. **Data Read:** Cryptogram or transformed UID read.
4. **Gateway Reception:** Gateway receives raw scan payload.
5. **Gateway Validation:** Basic integrity and format checks.
6. **Queue Event:** Gateway queues event locally if offline, or forwards if online.
7. **Server Ingress:** Server receives scan event (mTLS verified).
8. **Rate Limiting:** Redis checks for flood attacks.
9. **Duplicate Tap Check:** Redis filters repeated taps within a time window.
10. **Replay Protection:** Nonce verification.
11. **Security Transformation:** Cryptogram verification or UID HMAC.
12. **Credential Lookup:** Database query for active credential.
13. **Tenant Context Assertion:** RLS bound to school ID.
14. **Record Creation:** Attendance event logged to database.
15. **Acknowledgment:** Success response sent back to Gateway.

## Reader Adapter Abstraction
The system supports multiple reader types via an adapter pattern:
- `PCSCAdapter`: For PC/SC compliant readers.
- `NetworkAdapter`: For network-based readers (HID, Suprema).
- `WebSerialAdapter`: Browser-based reader integration.
- `KeyboardWedgeAdapter`: For legacy/prototype USB keyboard emulation (UID only).

## Database Schema
New tables added to support RFID:
- `rfid_cards`: Stores card credentials (HMAC digests, never raw UIDs).
- `rfid_scan_events`: Raw tap events for auditing.
- `rfid_key_versions`: Key rotation tracking.
- `rfid_readers`: Reader provisioning and status.

## Technology Stack
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM.
- **Database:** PostgreSQL (with RLS), Redis.
- **Security:** Argon2id, mTLS, HMAC-SHA256.
- **Monitoring:** Prometheus, Prom-client.
