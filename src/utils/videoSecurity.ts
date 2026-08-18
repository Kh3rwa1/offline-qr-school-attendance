/**
 * Video Security & Exact Hostname Allowlisting
 *
 * Implements strict, defense-in-depth URL parsing and ID extraction for embedded videos.
 * Never allows substring matching, credential injection, or unvalidated protocols.
 */

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts and strictly validates an 11-character YouTube video ID.
 * Returns null for any malicious, malformed, or unapproved host inputs.
 */
export function extractValidatedYouTubeId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // Direct 11-char bare ID string (must strictly match regex)
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    // Protocol must strictly be http: or https: (rejects javascript:, vbscript:, data:, file:, etc.)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Credentials embedded in URL are strictly rejected (e.g. https://user:pass@domain)
    if (parsed.username || parsed.password) {
      return null;
    }

    // Exact normalized hostname check
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_YOUTUBE_HOSTS.has(hostname)) {
      return null;
    }

    let candidateId: string | null = null;

    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      // Path format: /<id>
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        candidateId = segments[0];
      }
    } else {
      // youtube.com, www.youtube.com, m.youtube.com
      if (parsed.pathname === '/watch') {
        candidateId = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/embed/')) {
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
          candidateId = segments[1];
        }
      } else if (parsed.pathname.startsWith('/v/')) {
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
          candidateId = segments[1];
        }
      } else if (parsed.pathname.startsWith('/shorts/')) {
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
          candidateId = segments[1];
        }
      }
    }

    if (candidateId && YOUTUBE_ID_REGEX.test(candidateId)) {
      return candidateId;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Builds a strict, privacy-enhanced nocookie YouTube embed URL.
 * Returns null if the input is not a validated YouTube ID/URL.
 */
export function buildSafeYouTubeEmbedUrl(urlOrId: string | null | undefined): string | null {
  const videoId = extractValidatedYouTubeId(urlOrId);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}
