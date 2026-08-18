# Reporting Profile Guide

## Purpose

A reporting profile is a versioned layout and localization contract for internal attendance exports. It controls visible labels, column order, signature captions, document orientation, and the non-certification disclaimer. It does not make an export an authority-issued form.

## Built-in profile

Migration installs a global, read-only fallback profile with UUID:

```text
00000000-0000-4000-8000-000000000070
```

The built-in profile provides English, Bengali, and Hindi labels and disclaimers. It is used only when the school has no active default profile or when the caller does not select another accessible profile.

## Stored fields

A `reporting_profiles` row contains:

- `schoolId` — school-owned profiles use their tenant ID; the built-in fallback has no school ID;
- `profileName` — human-readable name;
- `version` — immutable version label copied into every generated report;
- `isDefault` and `isActive` — selection controls;
- `configuration` — JSON configuration validated by the server;
- `createdAt` and `updatedAt` — administrative timestamps.

The configuration contract includes:

```json
{
  "language": "BILINGUAL",
  "orientation": "LANDSCAPE",
  "columns": ["roll", "studentCode", "studentName", "studentNameBn"],
  "labels": {
    "en": { "title": "Attendance Register" },
    "bn": { "title": "হাজিরা রেজিস্টার" },
    "hi": { "title": "उपस्थिति रजिस्टर" }
  },
  "signatureBlocks": ["Class Teacher", "Head Teacher"],
  "disclaimer": {
    "en": "Internal school-management report; not government certification or proof of portal submission.",
    "bn": "বিদ্যালয়ের অভ্যন্তরীণ ব্যবস্থাপনা রিপোর্ট; সরকারি সার্টিফিকেশন বা পোর্টালে জমার প্রমাণ নয়।",
    "hi": "विद्यालय की आंतरिक प्रबंधन रिपोर्ट; सरकारी प्रमाणन या पोर्टल जमा करने का प्रमाण नहीं।"
  }
}
```

The exact allowed column keys are defined in `src/services/reportProfileService.ts`. Unknown or malformed configuration is rejected rather than guessed.

## Resolution order

1. If the request names a profile, it must be active and accessible to the active school.
2. Otherwise the service looks for the school's active default profile.
3. Otherwise it uses the built-in global fallback profile.
4. If no valid profile can be resolved, generation stops with a configuration error.

Tenant RLS permits schools to read their own profiles and the global fallback. A school cannot select another school's profile UUID.

## Snapshot and reproducibility

Generation stores all of the following with the immutable report artifact:

- profile ID;
- profile version;
- complete effective configuration snapshot.

Changing or deactivating a profile later does not change old artifacts. Generate a new report to use a revised profile.

## API

List profiles visible to the active school:

```http
GET /api/v1/schools/{schoolId}/reports/profiles
```

The response returns a `profiles` array with ID, name, version, default state, and effective configuration. Profile selection is available in the report wizard.

This release does not claim a complete profile-design UI. School-specific profile creation and review should use an authorized administrative provisioning process until that UI is implemented.

## Privacy review

Do not add guardian phone numbers, credentials, national identifiers, medical notes, or other sensitive fields merely because they are available in the database. Before enabling a new field, record:

- why the field is necessary;
- who may receive the export;
- how long the artifact is retained;
- how printed and downloaded copies are protected.