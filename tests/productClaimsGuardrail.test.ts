import { describe, it, expect } from 'vitest';
import { PRODUCT_CLAIMS, ClaimStatus, ProductClaim } from '../src/config/productClaims';

describe('Centralized Product Claims Registry & Guardrails', () => {
  it('registers all mandatory core, hardware, reporting, privacy, and performance claims', () => {
    const requiredClaimIds = [
      'offline-qr-attendance',
      'zebra-fx9600-payload-compatibility',
      'physical-fx9600-commissioning',
      'udise-oriented-reports',
      'government-acceptance',
      'dpdp-aligned-privacy-controls',
      'sms-queueing',
      'real-telecom-delivery',
      'english-localization',
      'bengali-localization',
      'hindi-localization',
      'encrypted-backups',
      'r2-replication',
      'accessibility-automation',
      'human-accessibility-certification',
      'real-school-deployments',
      'customer-testimonials',
      'attendance-speed',
      'cost-savings',
    ];

    const registeredIds = Object.values(PRODUCT_CLAIMS).map((c) => c.id);
    for (const reqId of requiredClaimIds) {
      expect(registeredIds, `Mandatory claim "${reqId}" must be registered`).toContain(reqId);
    }
  });

  it('proves claims have valid ClaimStatus and non-empty approved copy in EN, BN, and HI', () => {
    const validStatuses: ClaimStatus[] = [
      'AUTOMATION_VERIFIED',
      'INTERNALLY_REVIEWED',
      'PILOT_VALIDATED',
      'EXTERNALLY_VALIDATED',
      'EXTERNALLY_PENDING',
      'UNSUPPORTED',
      'RETIRED',
    ];

    Object.values(PRODUCT_CLAIMS).forEach((claim: ProductClaim) => {
      expect(validStatuses).toContain(claim.status);
      expect(claim.approvedPublicCopy.en.trim().length).toBeGreaterThan(10);
      expect(claim.approvedPublicCopy.bn.trim().length).toBeGreaterThan(10);
      expect(claim.approvedPublicCopy.hi.trim().length).toBeGreaterThan(10);
      expect(claim.evidence.length).toBeGreaterThan(0);
      expect(claim.lastReviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('marks physical hardware commissioning, telecom delivery, and human UAT strictly as EXTERNALLY_PENDING', () => {
    expect(PRODUCT_CLAIMS.physicalFx9600Commissioning.status).toBe('EXTERNALLY_PENDING');
    expect(PRODUCT_CLAIMS.realTelecomDelivery.status).toBe('EXTERNALLY_PENDING');
    expect(PRODUCT_CLAIMS.humanAccessibilityCertification.status).toBe('EXTERNALLY_PENDING');
    expect(PRODUCT_CLAIMS.realSchoolDeployments.status).toBe('EXTERNALLY_PENDING');
    expect(PRODUCT_CLAIMS.customerTestimonials.status).toBe('EXTERNALLY_PENDING');
    expect(PRODUCT_CLAIMS.governmentAcceptance.status).toBe('EXTERNALLY_PENDING');
  });

  it('contains explicit prohibited phrases for claims prone to marketing exaggeration', () => {
    expect(PRODUCT_CLAIMS.udiseOrientedReports.prohibitedPhrases).toContain('UDISE+ certified');
    expect(PRODUCT_CLAIMS.governmentAcceptance.prohibitedPhrases).toContain('Government approved');
    expect(PRODUCT_CLAIMS.dpdpAlignedPrivacyControls.prohibitedPhrases).toContain('DPDP certified');
    expect(PRODUCT_CLAIMS.physicalFx9600Commissioning.prohibitedPhrases).toContain('Hardware certified 10/10');
  });
});
