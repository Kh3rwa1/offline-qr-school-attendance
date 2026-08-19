# AttendEase OS — External Evidence Required

> **Document Status**: LIVING_REGISTER  
> **Policy**: No external gate may be marked VERIFIED until authentic physical/external evidence is attached here.  
> **Last Updated**: 2026-08-18

This document enumerates every item that cannot be completed by software alone. It provides:
- The exact evidence required
- Who is responsible for obtaining it
- The procedure/template to follow
- Where to file evidence once obtained

---

## EV-01: Physical Zebra FX9600 Gate Reader Commissioning

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: On-site hardware integrator / network engineer  
**Prerequisite**: Zebra FX9600 reader, AN480 antenna(s), school site access

### Required Evidence
1. Completed [`docs/hardware/FX9600_COMMISSIONING_TEMPLATE.md`](../hardware/FX9600_COMMISSIONING_TEMPLATE.md)
2. Reader serial number and firmware version log
3. RF read-zone test results (missed-read rate ≤ 2%, false-read rate ≤ 0.1%)
4. Doorway burst test results (≥ 30 students crossing in 60 seconds)
5. Network outage recovery test result
6. Technician identity and physical sign-off
7. SHA-256 hash of this evidence linked to the exact release SHA

### Procedure
1. Deploy the FX9600 at the school entrance
2. Configure IoT Connector to POST to `https://<school-server>/api/v1/schools/<schoolId>/rfid/zebra/reads`
3. Configure HMAC-SHA256 secret or Bearer token in the reader's IoT Connector settings
4. Run the read-zone test using the checklist in [`docs/hardware/FX9600_EVIDENCE_REQUIREMENTS.md`](../hardware/FX9600_EVIDENCE_REQUIREMENTS.md)
5. File completed evidence in this document under "Filed Evidence" section below

### Do Not Claim
- "Physically commissioned" without this evidence
- "Production RFID ready" without this evidence
- "Antenna tuned" without RF measurement results

---

## EV-02: Indian DLT Telecom Carrier SMS Delivery

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: School administrator / principal entity  
**Prerequisite**: Active DLT principal entity registration with Jio/Airtel/Vi

### Required Evidence
1. DLT principal entity registration certificate (screenshot + PDF)
2. Approved SMS template IDs for absence notifications
3. Telecom sender header (e.g., `TX-SCHATD`)
4. Delivery receipt screenshots for ≥ 10 test SMS messages across different networks
5. Evidence date and attesting name

### Procedure
1. Complete DLT registration at https://www.trai.gov.in/
2. Get template approval from telecom carrier
3. Set in `.env`:
   ```
   SMS_PROVIDER=dlt
   DLT_SENDER_ID=TX-YOURSCHOOL
   DLT_TEMPLATE_ID=<approved-template-id>
   DLT_AUTH_TOKEN=<carrier-api-key>
   ```
4. Send 10 test SMS via `./bin/attendease test-sms +91XXXXXXXXXX`
5. File delivery receipts here

### Do Not Claim
- "SMS delivery verified" without delivery receipts
- "Live carrier integration" without actual DLT credentials configured

---

## EV-03: Human Screen-Reader User Acceptance Testing

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: Accessibility specialist, school teachers with visual impairment  
**Protocol**: [`docs/audits/ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md`](../audits/ACCESSIBILITY_HUMAN_VALIDATION_PLAN.md)

### Required Evidence
1. TalkBack evaluation: ≥ 2 Android users completing teacher roll-call flow
2. VoiceOver evaluation: ≥ 2 iOS users completing teacher roll-call flow
3. NVDA evaluation: ≥ 1 Windows user completing admin report export
4. Signed evaluator attestation forms (`docs/UAT_SIGNOFF_TEMPLATE.md`)
5. Task completion rates and barrier report

### Do Not Claim
- "WCAG 2.2 AA human-certified" without signed evaluations
- "Accessible for screen reader users" without real user evidence

---

## EV-04: Government / Education Authority Formal Acceptance

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: School headmaster / District Education Officer (DEO)  

### Required Evidence
1. Formal written acceptance letter from DEO or equivalent authority
2. Record of submitted attendance export to government portal
3. Portal acceptance confirmation (screenshot or reference number)

### Do Not Claim
- "Government approved format"
- "UDISE+ certified" 
- "Officially accepted by education department"
Without the above evidence.

---

## EV-05: Independent Third-Party Security Penetration Testing (VAPT)

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: CERT-In empaneled security auditor  

### Required Evidence
1. VAPT engagement letter
2. Grey-box web application penetration test report
3. Multi-tenant PostgreSQL RLS bypass audit results
4. Finding severity summary with remediation status
5. Auditor name, registration number, and date

### Do Not Claim
- "Independently security audited"
- "Penetration tested"
Without the above evidence.

---

## EV-06: Live Cloudflare R2 / S3 Off-Site Backup Disaster Recovery Drill

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: School operator / SRE  
**Prerequisite**: Active R2 or S3 account with configured credentials in `.env`

### Required Evidence
1. Output of `npx tsx scripts/runR2LiveDrill.ts` with real credentials
2. Confirmation that file was uploaded to R2 bucket
3. Successful download and integrity verification
4. Evidence date, operator name, R2 bucket name (no secrets)

### Procedure
1. Set R2 credentials in `.env`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=attendease-backups-prod
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```
2. Run: `npx tsx scripts/runR2LiveDrill.ts`
3. File evidence here

---

## EV-07: Independent Production Uptime Monitoring

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: School operator  

### Required Evidence
1. External monitoring service configured (UptimeRobot, Freshping, healthchecks.io)
2. Monitor URL: `https://<school-domain>/api/v1/health`
3. 30-day uptime report (≥ 99.0% uptime for production claim)

### Do Not Claim
- "99.9% production uptime" without independent external monitor evidence

---

## EV-08: arm64 Native CI Validation

**Current Status**: `EXTERNALLY_PENDING`  
**Responsible Party**: DevOps  

### Required Evidence
1. Self-hosted arm64 runner configured in GitHub Actions
2. `installer-matrix-test` passing on `ubuntu-22.04-arm64` or equivalent
3. CI workflow URL with successful run on arm64

### Interim Status
Install script correctly detects `aarch64` and applies ARM64 paths, but this is unvalidated by CI. Use on arm64 hardware at own risk until native runner is available.

---

## Filed Evidence

> This section is empty. No external evidence has been filed.
> Update this section when each EV item is completed.

---

## Evidence Filing Template

When evidence is obtained, add an entry in the following format:

```markdown
### EV-XX Filed — [YYYY-MM-DD]
- **Evidence Type**: [commissioning report / delivery receipts / UAT report / etc.]
- **Filed By**: [Name, role]
- **Evidence Location**: [Link to signed PDF / screenshot / external URL]
- **SHA-256 of Evidence File**: [hash]
- **Release SHA at Time of Evidence**: [git sha]
- **Review Due**: [YYYY-MM-DD + revalidation interval]
```
