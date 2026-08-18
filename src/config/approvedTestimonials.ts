/**
 * AttendEase Approved Testimonials Registry
 *
 * All public testimonials must be backed by signed consent and a valid evidence ID.
 * When no verified testimonials exist, public landing views MUST omit the section entirely.
 */

export interface ApprovedTestimonial {
  id: string;
  quote: string;
  quoteLanguage: 'en' | 'bn' | 'hi';
  personName: string;
  role: string;
  organization: string;
  studentCount?: number;
  verified: boolean;
  consentEvidenceId: string;
  approvedAt: string;
  expiresAt?: string;
}

/**
 * Default verified testimonials list.
 * Initialized to empty array [] because no external consent-backed testimonials exist in the repository.
 * Never manufacture fictional names, roles, or quotes.
 */
export const APPROVED_TESTIMONIALS: ApprovedTestimonial[] = [];

/**
 * Filter helper ensuring only non-expired, verified testimonials with consent evidence are displayed.
 */
export function getActiveVerifiedTestimonials(
  testimonials: ApprovedTestimonial[] = APPROVED_TESTIMONIALS,
  now: Date = new Date()
): ApprovedTestimonial[] {
  return testimonials.filter((t) => {
    if (!t.verified) return false;
    if (!t.consentEvidenceId || t.consentEvidenceId.trim().length === 0) return false;
    if (!t.approvedAt || isNaN(new Date(t.approvedAt).getTime())) return false;
    if (t.expiresAt && new Date(t.expiresAt).getTime() < now.getTime()) return false;
    return true;
  });
}
