import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Anti-Cheating & Plain-Language Guardrail Suite', () => {
  const reportViewerFile = path.resolve(__dirname, '../src/dashboards/report-viewer/ReportViewerDashboard.tsx');
  const offlineWorkspaceFile = path.resolve(__dirname, '../src/dashboards/teacher/OfflineWorkspace.tsx');
  const assignedClassesFile = path.resolve(__dirname, '../src/dashboards/teacher/AssignedClasses.tsx');

  it('ReportViewerDashboard does not contain fake hardcoded numbers, fake charts, or cryptographic HMAC jargon', () => {
    const content = fs.readFileSync(reportViewerFile, 'utf-8');

    // Must not contain fake stat numbers
    expect(content).not.toMatch(/95\.4%/);
    expect(content).not.toMatch(/142/);
    expect(content).not.toMatch(/5048/);
    expect(content).not.toMatch(/HMAC/i);
    expect(content).not.toMatch(/Auditor Sync Stream/i);
    expect(content).not.toMatch(/Cryptographic/i);
    expect(content).not.toMatch(/\[96,\s*74,\s*98/);
    expect(content).not.toMatch(/Class 10-A/);
  });

  it('Teacher OfflineWorkspace does not expose database or cryptography jargon to the teacher', () => {
    const content = fs.readFileSync(offlineWorkspaceFile, 'utf-8');

    // Must not expose internal engineering jargon as visible UI text
    expect(content).not.toMatch(/IndexedDB/i);
    expect(content).not.toMatch(/Monotonic\s*Counter/i);
    expect(content).not.toMatch(/Replay\s*Protection/i);
    expect(content).not.toMatch(/Client\s+Event\s+ID/i);
    expect(content).not.toMatch(/Offline\s*Synchronization\s*Ledger/i);
    expect(content).not.toMatch(/Strict\s*Order\s*Guaranteed/i);

    // Must not render raw syncError directly without translation
    expect(content).not.toMatch(/\{e\.syncError\}/);
  });

  it('Teacher AssignedClasses does not expose database jargon', () => {
    const content = fs.readFileSync(assignedClassesFile, 'utf-8');

    expect(content).not.toMatch(/IndexedDB/i);
    expect(content).not.toMatch(/optical\s*QR\s*scanning/i);
    expect(content).not.toMatch(/attendance\s*roll\s*sign-off/i);
  });
});
