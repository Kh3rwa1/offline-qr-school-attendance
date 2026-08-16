import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
// @ts-ignore
import { JSDOM } from 'jsdom';
import { BentoScannerGrid } from '../src/components/BentoScannerGrid';
import { Header } from '../src/components/Header';
import * as fs from 'fs';
import * as path from 'path';

describe('WCAG 2.2 AA / AAA Accessibility & Mobile UX Tests', () => {
  const parseHtml = (htmlString: string): Document => {
    const dom = new JSDOM(htmlString);
    return dom.window.document;
  };

  describe('1. Minimum 14px Typography Standard', () => {
    it('should verify ReportViewerDashboard contains zero <14px text classes (no text-xs or text-[11px])', () => {
      const filePath = path.resolve(__dirname, '../src/dashboards/report-viewer/ReportViewerDashboard.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      expect(fileContent).not.toContain('text-[11px]');
      expect(fileContent).not.toContain('text-[10px]');
      expect(fileContent).not.toContain('text-[9px]');
      expect(fileContent).not.toContain('text-xs');
    });

    it('should verify TeacherDashboard and subviews contain zero <14px text classes', () => {
      const teacherPath = path.resolve(__dirname, '../src/dashboards/teacher/TeacherDashboard.tsx');
      const offlinePath = path.resolve(__dirname, '../src/dashboards/teacher/OfflineWorkspace.tsx');
      const assignedPath = path.resolve(__dirname, '../src/dashboards/teacher/AssignedClasses.tsx');

      const teacherContent = fs.readFileSync(teacherPath, 'utf-8');
      const offlineContent = fs.readFileSync(offlinePath, 'utf-8');
      const assignedContent = fs.readFileSync(assignedPath, 'utf-8');

      expect(teacherContent).not.toContain('text-[11px]');
      expect(teacherContent).not.toContain('text-[10px]');
      expect(offlineContent).not.toContain('text-[11px]');
      expect(offlineContent).not.toContain('text-[10px]');
      expect(assignedContent).not.toContain('text-[11px]');
      expect(assignedContent).not.toContain('text-[10px]');
    });

    it('should verify BentoScannerGrid and Header enforce >=14px typography', () => {
      const gridPath = path.resolve(__dirname, '../src/components/BentoScannerGrid.tsx');
      const headerPath = path.resolve(__dirname, '../src/components/Header.tsx');

      const gridContent = fs.readFileSync(gridPath, 'utf-8');
      const headerContent = fs.readFileSync(headerPath, 'utf-8');

      expect(gridContent).not.toContain('text-[11px]');
      expect(gridContent).not.toContain('text-[10px]');
      expect(gridContent).not.toContain('text-xs');

      expect(headerContent).not.toContain('text-[11px]');
      expect(headerContent).not.toContain('text-[10px]');
      expect(headerContent).not.toContain('text-xs');
    });
  });

  describe('2. Chart Accessibility & Multimodal Data Table Equivalents', () => {
    it('should verify ReportViewerDashboard attendance turnout gauge has role="img", localized title/desc, and reduced motion', () => {
      const filePath = path.resolve(__dirname, '../src/dashboards/report-viewer/ReportViewerDashboard.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check SVG Gauge attributes
      expect(fileContent).toContain('role="img"');
      expect(fileContent).toContain('useId()');
      expect(fileContent).toContain('useReducedMotion()');
      expect(fileContent).toContain('aria-labelledby={`${gaugeTitleId} ${gaugeDescId}`}');
      expect(fileContent).toContain('<title id={gaugeTitleId}>');
      expect(fileContent).toContain('<desc id={gaugeDescId}>');
      expect(fileContent).toContain('motion-reduce:transition-none');

      // Check Screen-Reader Data Table Alternative
      expect(fileContent).toContain('className="sr-only"');
      expect(fileContent).toContain('<caption className="sr-only">');
      expect(fileContent).toContain('<table');
    });
  });

  describe('3. Touch Target Minimum 44x44px Dimensions', () => {
    it('should inspect all rendered controls in BentoScannerGrid and verify min 44px touch targets', () => {
      const mockSession = {
        id: 'sess-1',
        className: 'Class 9',
        section: 'A',
        teacherName: 'Subhas Bose',
        date: '2026-08-16',
        totalStudents: 30,
        presentCount: 25,
        absentCount: 5,
        status: 'OPEN' as const,
      };

      const html = renderToString(
        <BentoScannerGrid
          session={mockSession}
          students={[]}
          lastScannedStudent={null}
          language="bn"
          networkStatus="ONLINE"
          pendingSyncCount={0}
          onScanStudent={() => {}}
          onSyncNow={() => {}}
          onOpenManualModal={() => {}}
          onFinalizeSession={() => {}}
          scanFeedback={null}
        />
      );

      const doc = parseHtml(html);
      const buttons = doc.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((btn) => {
        const classNames = btn.className;
        const satisfiesTarget =
          classNames.includes('min-h-[44px]') ||
          classNames.includes('min-h-[48px]') ||
          classNames.includes('h-18') ||
          classNames.includes('h-20') ||
          classNames.includes('h-16') ||
          classNames.includes('py-2.5') ||
          classNames.includes('py-3');
        expect(satisfiesTarget, `Button "${btn.textContent}" must satisfy minimum 44px touch target`).toBe(true);
      });
    });

    it('should inspect all rendered controls in Header and verify min 44px touch targets', () => {
      const html = renderToString(
        <Header
          language="bn"
          setLanguage={() => {}}
          networkStatus="ONLINE"
          toggleNetworkStatus={() => {}}
          activeView="scanner"
          setActiveView={() => {}}
          pendingSyncCount={0}
        />
      );

      const doc = parseHtml(html);
      const buttons = doc.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((btn) => {
        const classNames = btn.className;
        const satisfiesTarget =
          classNames.includes('min-h-[44px]') ||
          classNames.includes('min-h-[48px]') ||
          classNames.includes('py-2.5') ||
          classNames.includes('py-3');
        expect(satisfiesTarget, `Header button "${btn.textContent}" must satisfy minimum 44px touch target`).toBe(true);
      });
    });
  });

  describe('4. Keyboard Navigation & Accessible Names', () => {
    it('should verify all interactive elements have accessible names and labels', () => {
      const html = renderToString(
        <Header
          language="bn"
          setLanguage={() => {}}
          networkStatus="OFFLINE"
          toggleNetworkStatus={() => {}}
          activeView="scanner"
          setActiveView={() => {}}
          pendingSyncCount={3}
        />
      );

      const doc = parseHtml(html);
      const buttons = doc.querySelectorAll('button');
      buttons.forEach((btn) => {
        const accessibleName = btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent?.trim();
        expect(accessibleName, 'Interactive button must have non-empty accessible name').toBeTruthy();
      });
    });
  });
});
