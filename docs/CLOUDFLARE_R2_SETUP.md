# Cloudflare R2 Off-Host Backup & Disaster Recovery Guide

AttendEase OS uses **Cloudflare R2** exclusively for zero-egress-fee, immutable off-host backup replication and automated disaster recovery.

---

## 1. Cloudflare R2 Configuration Matrix

| Environment Variable | Description | Example / Default | Required |
| :--- | :--- | :--- | :---: |
| `R2_ACCOUNT_ID` | Cloudflare Account ID (32-hex characters) | `9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d` | **Yes (Prod)** |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Token Access Key ID | `0123456789abcdef0123456789abcdef` | **Yes (Prod)** |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Token Secret Access Key | `0123456789abcdef...` (64 characters) | **Yes (Prod)** |
| `R2_BUCKET` | Dedicated Cloudflare R2 Bucket Name | `attendease-production-backups` | **Yes (Prod)** |
| `R2_ENDPOINT` | R2 S3-Compatible Endpoint | `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` | **Yes (Prod)** |
| `R2_PREFIX` | S3 Object Key Root Prefix | `attendease-backups/` | No (`attendease-backups/`) |
| `R2_JURISDICTION` | Optional R2 Jurisdiction (`eu`, `fedramp`) | `eu` | No |
| `R2_RETENTION_DAYS` | Remote retention window in days | `30` | No (`30`) |
| `R2_UPLOAD_TIMEOUT_SECONDS`| Upload and verify timeout per file | `60` | No (`60`) |
| `R2_MAX_RETRIES` | Max retries with exponential backoff & jitter | `3` | No (`3`) |
| `R2_REQUIRED_IN_PRODUCTION`| Fail closed if R2 replication fails | `true` | No (`true`) |

---

## 2. Least-Privilege R2 Token Provisioning

In the Cloudflare Dashboard:
1. Navigate to **R2 Storage** -> **Manage R2 API Tokens**.
2. Click **Create API Token**.
3. Select **Object Read & Write**.
4. Restrict permissions specifically to the dedicated backup bucket (`attendease-production-backups`).
5. Set TTL / Expiry according to your organization's security policy.
6. Copy `Access Key ID` and `Secret Access Key` into `.env` (never commit secrets to version control).

---

## 3. Cloudflare R2 Bucket Lifecycle & Lock Rules

### Automated Lifecycle Rule (30-Day Auto-Expiration)
Configure in Cloudflare Dashboard -> **R2** -> `attendease-production-backups` -> **Settings** -> **Lifecycle Rules**:
- **Rule Name**: `ExpireOldBackups`
- **Prefix**: `attendease-backups/`
- **Action**: Delete objects after **30 days**.

### Object Lock / Immutability
To protect against ransomware and accidental deletion:
- Enable **R2 Object Lock** on bucket creation with Compliance mode for 14 or 30 days.

---

## 4. Environment Examples

### Development (`.env.local`)
```bash
NODE_ENV=development
R2_REQUIRED_IN_PRODUCTION=false
```

### CI / Test (`.env.test`)
```bash
NODE_ENV=test
R2_BUCKET=attendease-ci-backups
R2_ACCESS_KEY_ID=test-access-key-id-0123456789abcdef
R2_SECRET_ACCESS_KEY=test-secret-access-key-0123456789abcdef0123456789abcdef
R2_ENDPOINT=https://test-account-id.r2.cloudflarestorage.com
R2_REQUIRED_IN_PRODUCTION=false
```

### Production (`.env`)
```bash
NODE_ENV=production
R2_ACCOUNT_ID=9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d
R2_ACCESS_KEY_ID=11223344556677889900aabbccddeeff
R2_SECRET_ACCESS_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
R2_BUCKET=attendease-production-backups
R2_ENDPOINT=https://9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d.r2.cloudflarestorage.com
R2_PREFIX=attendease-backups/
R2_RETENTION_DAYS=30
R2_UPLOAD_TIMEOUT_SECONDS=60
R2_MAX_RETRIES=3
R2_REQUIRED_IN_PRODUCTION=true
```
