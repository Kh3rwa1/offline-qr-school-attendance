import { describe, it, expect } from 'vitest';
import { sanitizeSlug, isValidSlug, generateSchoolSlug } from '../src/services/schoolSlug';

describe('School Slug Utilities Suite', () => {
  it('1. sanitizeSlug correctly normalizes strings, diacritics, and punctuation', () => {
    expect(sanitizeSlug('Green Valley High School')).toBe('green-valley-high-school');
    expect(sanitizeSlug('   St. Xavier\'s Model School   ')).toBe('st-xavier-s-model-school');
    expect(sanitizeSlug('École Primaire d\'Élite')).toBe('ecole-primaire-d-elite');
    expect(sanitizeSlug('---Multiple---Dashes---')).toBe('multiple-dashes');
    expect(sanitizeSlug('')).toBe('');
  });

  it('2. isValidSlug enforces strict Postgres CHECK format: ^[a-z0-9]+(-[a-z0-9]+)*$', () => {
    expect(isValidSlug('green-valley')).toBe(true);
    expect(isValidSlug('rampur-high-school-0101')).toBe(true);
    expect(isValidSlug('school-a')).toBe(true);
    expect(isValidSlug('k12')).toBe(true);

    // Invalid format test cases
    expect(isValidSlug('Green-Valley')).toBe(false); // uppercase
    expect(isValidSlug('-leading-dash')).toBe(false);
    expect(isValidSlug('trailing-dash-')).toBe(false);
    expect(isValidSlug('double--dash')).toBe(false);
    expect(isValidSlug('with.dots')).toBe(false);
    expect(isValidSlug('with_underscores')).toBe(false);
    expect(isValidSlug('a')).toBe(false); // min length 2
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(81))).toBe(false); // max length 80
  });

  it('3. generateSchoolSlug constructs deterministic, collision-resilient slugs', () => {
    const slugA = generateSchoolSlug('Rampur High School', '19100100101');
    expect(slugA).toBe('rampur-high-school-0101');

    const slugB = generateSchoolSlug('Haripur High School', '19100100102');
    expect(slugB).toBe('haripur-high-school-0102');

    const slugNoUdise = generateSchoolSlug('Adarsha Vidyalaya');
    expect(slugNoUdise).toBe('adarsha-vidyalaya');

    const slugFallback = generateSchoolSlug('');
    expect(slugFallback).toBe('school');
  });
});
