/**
 * School Slug Helper Utilities
 * Formats, validates, and generates stable URL path slugs for school workspaces (/s/:schoolSlug).
 */

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

/**
 * Normalizes input string to lowercased, hyphen-separated alphanumeric characters.
 */
export function sanitizeSlug(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // convert non-alphanumeric chars to single dash
    .replace(/^-+|-+$/g, '') // trim leading and trailing dashes
    .slice(0, 65);
}

/**
 * Validates whether a slug matches Postgres constraint CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$').
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  const trimmed = slug.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_SLUG_LENGTH) return false;
  return SLUG_REGEX.test(trimmed);
}

/**
 * Generates a deterministic, unique-friendly slug from school name and optional UDISE code.
 * Example: ("Rampur High School", "19100100101") -> "rampur-high-school-0101"
 */
export function generateSchoolSlug(name: string, udiseCode?: string): string {
  const base = sanitizeSlug(name) || 'school';
  if (udiseCode && udiseCode.trim()) {
    const cleanUdise = udiseCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const suffix = cleanUdise.length >= 4 ? cleanUdise.slice(-4) : cleanUdise;
    if (suffix) {
      const combined = `${base}-${suffix}`;
      return combined.slice(0, MAX_SLUG_LENGTH);
    }
  }
  return base.slice(0, MAX_SLUG_LENGTH);
}
