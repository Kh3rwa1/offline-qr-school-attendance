import { describe, it, expect } from 'vitest';
import { extractValidatedYouTubeId, buildSafeYouTubeEmbedUrl } from '../src/utils/videoSecurity';

describe('Video Security & Strict Hostname Allowlisting', () => {
  it('extracts valid 11-char YouTube ID from standard youtube.com watch URLs', () => {
    expect(extractValidatedYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractValidatedYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
    expect(extractValidatedYouTubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts valid 11-char YouTube ID from youtu.be short URLs and embed URLs', () => {
    expect(extractValidatedYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractValidatedYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractValidatedYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts direct valid 11-character bare video ID strings', () => {
    expect(extractValidatedYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractValidatedYouTubeId('abc123XYZ-_')).toBe('abc123XYZ-_');
  });

  it('strictly rejects malicious domain spoofing and domain confusion attempts', () => {
    // Malicious attacker domains that contain "youtu.be" or "youtube.com" as subdomains/substrings
    expect(extractValidatedYouTubeId('https://evil-youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractValidatedYouTubeId('https://youtu.be.attacker.example/dQw4w9WgXcQ')).toBeNull();
    expect(extractValidatedYouTubeId('https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractValidatedYouTubeId('https://attacker.example/youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('strictly rejects malicious protocols, credential injections, and malformed strings', () => {
    expect(extractValidatedYouTubeId('javascript:alert(1)')).toBeNull();
    expect(extractValidatedYouTubeId('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(extractValidatedYouTubeId('file:///etc/passwd')).toBeNull();
    expect(extractValidatedYouTubeId('https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractValidatedYouTubeId('')).toBeNull();
    expect(extractValidatedYouTubeId('   ')).toBeNull();
    expect(extractValidatedYouTubeId(null as any)).toBeNull();
    expect(extractValidatedYouTubeId(undefined as any)).toBeNull();
    expect(extractValidatedYouTubeId('dQw4w9WgXc')).toBeNull(); // 10 chars (too short)
    expect(extractValidatedYouTubeId('dQw4w9WgXcQ1')).toBeNull(); // 12 chars (too long)
    expect(extractValidatedYouTubeId('dQw4w9WgXc$')).toBeNull(); // invalid char ($)
  });

  it('builds privacy-safe youtube-nocookie embed URLs strictly for valid videos', () => {
    const validEmbed = buildSafeYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(validEmbed).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1');

    const invalidEmbed = buildSafeYouTubeEmbedUrl('https://evil.com/video');
    expect(invalidEmbed).toBeNull();
  });
});
