---
title: "Hardware Compatibility and Gate Infrastructure"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# Hardware Compatibility and Gate Infrastructure

This document outlines the supported physical gate hardware, antenna configurations, network topology, and tag standards for AttendEase OS.

## 1. Primary Gate RFID Reader: Zebra FX9600

AttendEase OS integrates directly with the **Zebra FX9600 Fixed UHF RFID Reader** via its native IoT Connector HTTP/HTTPS webhook egress.

| Specification | Requirement / Recommendation |
| :--- | :--- |
| **Model** | Zebra FX9600 (4-Port or 8-Port) |
| **Firmware** | v3.1.12 or newer |
| **Interface** | 10/100 Ethernet with 802.3af PoE (Power over Ethernet) or +24V DC power supply |
| **Protocol** | Zebra IoT Connector HTTP POST webhook with HMAC-SHA256 request signing or Bearer token over TLS |
| **Antennas** | Up to 4 or 8 circular-polarized UHF antennas (e.g. Zebra AN480 or AN440) |
| **Operating Frequency** | 865–867 MHz (ETSI / India WPC compliant) or regional equivalent |

## 2. RFID Tag Standard

| Attribute | Specification |
| :--- | :--- |
| **Air Interface Protocol** | EPC Gen 2 / ISO 18000-63 (UHF RFID) |
| **Operating Frequency** | 860–960 MHz UHF |
| **Supported Inlays / ICs** | Alien Higgs-3 / Higgs-EC, Impinj Monza 4 / R6 / M700, NXP UCODE 7 / 8 / 9 |
| **EPC Memory** | 96-bit or 128-bit EPC (hex canonicalized) |
| **Form Factor** | PVC Student Identity Badge with lanyard or wristband |

## 3. Classroom & Mobile Scanner Hardware

For classroom attendance, offline teacher use, and badge enrollment:

| Hardware Type | Supported Interface | Usage |
| :--- | :--- | :--- |
| **USB 2D Barcode Scanner** | USB HID Keyboard Wedge | Connects to school PC/laptop for fast QR scanning |
| **Webcam / Smartphone Camera** | HTML5 Camera Stream via `@zxing` | Mobile teacher phone browser scanning |
| **USB Desktop UHF Reader** | USB Virtual COM / WebSerial / HID | Office enrollment of UHF badge tags |

## 4. Network and Power Infrastructure

- **Network Switch:** 8-port Managed PoE Switch (e.g. Cisco CBS250, UniFi PoE) located in the gatehouse or administrative office.
- **Cabling:** Shielded Twisted Pair (Cat6 STP) from reader to PoE switch (max 100 meters).
- **Power Backup:** Dedicated 1 kVA Online UPS providing ≥ 2 hours battery runtime during morning power cuts.
