---
title: "ADR-006: Retire PC/SC smartcard and DESFire support"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# ADR-006: Retire PC/SC smartcard and DESFire support

- Status: Accepted
- Date: 2026-10-06
- Supersedes: None

## Context
AttendEase targets walk-through UHF RFID gates (Zebra FX9600, EPC Gen2). The legacy PC/SC + DESFire smartcard path (gateway daemon, `/rfid/scans`, AES-CMAC card proofs, AN10922 key diversification) has no live deployments, no physical hardware in test, and contains hand-rolled cryptography with no external cryptographic review.

## Decision
Remove the gateway daemon, `/rfid/scans` endpoint, DESFire crypto helpers, PC/SC system packages (`pcsc-lite`, `pcsc-lite-libs`, `ccid`), and the `pcsclite` optional dependency in v2.0.0.

## Consequences
- Smaller attack surface: removes legacy smartcard daemon and hand-rolled AES-CMAC cryptographic code.
- Smaller and faster runtime container image: eliminates `pcsc-lite`, `ccid`, and native compilation toolchain (`python3`, `make`, `g++`) from production image.
- Re-adding smartcard support in the future would require a dedicated ADR, external cryptographic review, and a vetted CMAC library instead of hand-rolled crypto.
