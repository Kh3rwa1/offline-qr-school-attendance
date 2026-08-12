/**
 * Utility functions for SMS processing, phone number redaction,
 * segment calculation, and template rendering.
 */

/**
 * Redacts complete phone numbers to protect privacy.
 * Example: "+919876543210" => "+91 98****3210"
 * Example: "9876543210" => "98****3210"
 */
export function redactPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '***';
  const trimmed = phone.trim();
  if (trimmed.length < 7) return '***';

  if (trimmed.startsWith('+')) {
    // e.g. +919876543210 (length 13) -> +91 98****3210
    const countryCodeEnd = trimmed.length > 12 ? 3 : 2; // e.g. +91
    const prefix = trimmed.substring(0, countryCodeEnd + 2); // e.g. +9198 or +91 98
    const suffix = trimmed.substring(trimmed.length - 4);
    const middleLength = Math.max(1, trimmed.length - prefix.length - suffix.length);
    return `${prefix}${'*'.repeat(middleLength)}${suffix}`;
  } else {
    // e.g. 9876543210 -> 98****3210
    const prefix = trimmed.substring(0, 2);
    const suffix = trimmed.substring(trimmed.length - 4);
    const middleLength = Math.max(1, trimmed.length - prefix.length - suffix.length);
    return `${prefix}${'*'.repeat(middleLength)}${suffix}`;
  }
}

/**
 * Estimates SMS segment usage based on GSM 7-bit vs Unicode (UTF-16/Bengali) content rules.
 * - GSM 7-bit: 1 segment = 160 chars, multi-segment = 153 chars/segment
 * - Unicode (Bengali): 1 segment = 70 chars, multi-segment = 67 chars/segment
 */
export function estimateSmsSegments(message: string): {
  charCount: number;
  isUnicode: boolean;
  segmentCount: number;
} {
  if (!message) {
    return { charCount: 0, isUnicode: false, segmentCount: 0 };
  }

  // Basic GSM 7-bit regex check (including basic ASCII, numbers, standard punctuation)
  // GSM 7-bit character set check:
  const isGsm = /^[\n\r a-zA-Z0-9@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#$%&'()*+,\-./:;<=>?^{}\\[~]|€]*$/.test(message);
  const isUnicode = !isGsm;
  const charCount = Array.from(message).length; // Proper Unicode character length count

  let segmentCount = 1;
  if (isUnicode) {
    if (charCount <= 70) {
      segmentCount = 1;
    } else {
      segmentCount = Math.ceil(charCount / 67);
    }
  } else {
    if (charCount <= 160) {
      segmentCount = 1;
    } else {
      segmentCount = Math.ceil(charCount / 153);
    }
  }

  return {
    charCount,
    isUnicode,
    segmentCount,
  };
}

/**
 * Validates template syntax and checks for required placeholder variables.
 */
export function validateTemplateVariables(
  template: string,
  requiredVars: string[] = []
): { valid: boolean; foundVars: string[]; missingVars: string[] } {
  if (!template) {
    return { valid: false, foundVars: [], missingVars: requiredVars };
  }

  const matches = template.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
  const foundVars = Array.from(new Set(matches.map((m) => m.slice(1, -1))));

  const missingVars = requiredVars.filter((v) => !foundVars.includes(v));
  const valid = missingVars.length === 0;

  return {
    valid,
    foundVars,
    missingVars,
  };
}

/**
 * Renders a template with variable values.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}
