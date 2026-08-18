import { describe, it, expect } from 'vitest';
import {
  calculateAttendanceEstimates,
  sanitizeNumber,
  DEFAULT_ASSUMPTIONS,
  CALCULATION_METHODOLOGY,
} from '../src/app/landingAssumptions';

describe('School Operational Assumptions & Savings Calculator', () => {
  it('calculates standard default baseline for a 750-student secondary school in QR mode', () => {
    const estimates = calculateAttendanceEstimates();

    expect(estimates.sanitizedStudentCount).toBe(750);
    expect(estimates.mode).toBe('QR');
    expect(estimates.paperAnnualTeacherHours).toBeGreaterThan(500);
    expect(estimates.digitalAnnualTeacherHours).toBeLessThan(estimates.paperAnnualTeacherHours);
    expect(estimates.annualTeacherHoursSaved).toBeGreaterThan(0);
    expect(estimates.annualPaperSheetsSaved).toBe(3000);
    expect(estimates.disclaimer).toContain('Illustrative estimate based on selected assumptions');
  });

  it('handles 0 students boundary cleanly without dividing by zero or NaN', () => {
    const estimates = calculateAttendanceEstimates({ studentCount: 0 });

    expect(estimates.sanitizedStudentCount).toBe(0);
    expect(estimates.paperAnnualTeacherHours).toBe(0);
    expect(estimates.digitalAnnualTeacherHours).toBe(0);
    expect(estimates.annualTeacherHoursSaved).toBe(0);
    expect(estimates.annualPaperSheetsSaved).toBe(0);
    expect(estimates.estimatedTeacherTimeValueSavedInr).toBe(0);
    expect(estimates.dailyAttendanceTimeFormatted.paper).toBe('0 min');
  });

  it('handles small school tier (< 300 students) with zero software subscription cost', () => {
    const estimates = calculateAttendanceEstimates({ studentCount: 200 });

    expect(estimates.sanitizedStudentCount).toBe(200);
    expect(estimates.estimatedSoftwareCostInr).toBe(0);
    expect(estimates.annualTeacherHoursSaved).toBeGreaterThan(0);
  });

  it('handles large school scale (5,000+ students) within reasonable numeric limits', () => {
    const estimates = calculateAttendanceEstimates({ studentCount: 5000 });

    expect(estimates.sanitizedStudentCount).toBe(5000);
    expect(estimates.annualPaperSheetsSaved).toBe(20000);
    expect(isFinite(estimates.estimatedTeacherTimeValueSavedInr)).toBe(true);
    expect(isFinite(estimates.estimatedSoftwareCostInr)).toBe(true);
  });

  it('handles negative, decimal, and missing invalid values gracefully via sanitizeNumber', () => {
    expect(sanitizeNumber(-50, 100, 0, 1000)).toBe(0);
    expect(sanitizeNumber(NaN, 100, 0, 1000)).toBe(100);
    expect(sanitizeNumber(undefined, 100, 0, 1000)).toBe(100);
    expect(sanitizeNumber(9999999, 100, 0, 1000)).toBe(1000);
    expect(sanitizeNumber(12.75, 100, 0, 1000)).toBe(12.75);
  });

  it('proves RFID mode has lower daily digital attendance time than QR mode', () => {
    const qrEstimates = calculateAttendanceEstimates({ studentCount: 1000, attendanceMode: 'QR' });
    const rfidEstimates = calculateAttendanceEstimates({ studentCount: 1000, attendanceMode: 'RFID' });

    expect(rfidEstimates.digitalAnnualTeacherHours).toBeLessThanOrEqual(qrEstimates.digitalAnnualTeacherHours);
    expect(rfidEstimates.annualTeacherHoursSaved).toBeGreaterThanOrEqual(qrEstimates.annualTeacherHoursSaved);
  });

  it('provides calculation methodology notes in EN, BN, and HI', () => {
    expect(CALCULATION_METHODOLOGY.en.points.length).toBeGreaterThanOrEqual(5);
    expect(CALCULATION_METHODOLOGY.bn.points.length).toBeGreaterThanOrEqual(5);
    expect(CALCULATION_METHODOLOGY.hi.points.length).toBeGreaterThanOrEqual(5);

    CALCULATION_METHODOLOGY.en.points.forEach((pt) => expect(pt.length).toBeGreaterThan(10));
    CALCULATION_METHODOLOGY.bn.points.forEach((pt) => expect(pt.length).toBeGreaterThan(10));
    CALCULATION_METHODOLOGY.hi.points.forEach((pt) => expect(pt.length).toBeGreaterThan(10));
  });
});
