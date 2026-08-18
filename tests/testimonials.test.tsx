import { describe, it, expect } from 'vitest';
import {
  APPROVED_TESTIMONIALS,
  getActiveVerifiedTestimonials,
  ApprovedTestimonial,
} from '../src/config/approvedTestimonials';

describe('Approved Testimonials Registry & Safe Rendering Policy', () => {
  it('defaults to an empty verified list [] to avoid unverified testimonials in production', () => {
    expect(APPROVED_TESTIMONIALS).toEqual([]);
    const active = getActiveVerifiedTestimonials(APPROVED_TESTIMONIALS);
    expect(active).toEqual([]);
  });

  it('filters out unverified, unapproved, or consent-lacking testimonials', () => {
    const mockList: ApprovedTestimonial[] = [
      {
        id: 't-1',
        quote: 'Great system for morning attendance',
        quoteLanguage: 'en',
        personName: 'Test Name',
        role: 'Headmaster',
        organization: 'Sample School',
        verified: false, // Unverified
        consentEvidenceId: 'CONSENT-101',
        approvedAt: '2026-08-01',
      },
      {
        id: 't-2',
        quote: 'Good offline support',
        quoteLanguage: 'en',
        personName: 'Another Name',
        role: 'Admin',
        organization: 'Another School',
        verified: true,
        consentEvidenceId: '', // Missing consent evidence
        approvedAt: '2026-08-01',
      },
      {
        id: 't-3',
        quote: 'Past trial quote',
        quoteLanguage: 'en',
        personName: 'Past Name',
        role: 'Teacher',
        organization: 'Past School',
        verified: true,
        consentEvidenceId: 'CONSENT-103',
        approvedAt: '2025-01-01',
        expiresAt: '2025-12-31', // Expired
      },
      {
        id: 't-4',
        quote: 'Valid verified quote with active consent',
        quoteLanguage: 'en',
        personName: 'Verified Leader',
        role: 'Principal',
        organization: 'Verified Academy',
        verified: true,
        consentEvidenceId: 'CONSENT-104',
        approvedAt: '2026-08-01',
        expiresAt: '2027-12-31', // Active
      },
    ];

    const active = getActiveVerifiedTestimonials(mockList, new Date('2026-08-18'));
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('t-4');
    expect(active[0].personName).toBe('Verified Leader');
  });

  it('preserves plain text quotes without HTML injection vulnerabilities', () => {
    const maliciousQuote = '<script>alert("xss")</script><b>Bold Quote</b>';
    const item: ApprovedTestimonial = {
      id: 't-sec',
      quote: maliciousQuote,
      quoteLanguage: 'en',
      personName: 'Security Tester',
      role: 'Reviewer',
      organization: 'Audit Lab',
      verified: true,
      consentEvidenceId: 'CONSENT-SEC-01',
      approvedAt: '2026-08-01',
    };

    const active = getActiveVerifiedTestimonials([item]);
    expect(active.length).toBe(1);
    expect(active[0].quote).toBe(maliciousQuote); // Kept as raw plain string; rendered via text nodes in React
  });
});
