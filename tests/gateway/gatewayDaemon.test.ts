import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildRfidApiUrl, GatewayDaemon } from '../../src/gateway/gatewayDaemon';

const scratchRoot = path.join(process.cwd(), 'scratch', 'gateway-daemon-tests');
const originalPcscSocketPath = process.env.PCSCD_SOCKET_PATH;

afterEach(() => {
  if (originalPcscSocketPath === undefined) {
    delete process.env.PCSCD_SOCKET_PATH;
  } else {
    process.env.PCSCD_SOCKET_PATH = originalPcscSocketPath;
  }
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

describe('GatewayDaemon production contracts', () => {
  it('builds URLs that match the server RFID router mount point', () => {
    expect(buildRfidApiUrl('https://attendance.example/', 'school-123', '/scans/')).toBe(
      'https://attendance.example/api/v1/schools/school-123/rfid/scans',
    );
    expect(buildRfidApiUrl('https://attendance.example', 'school-123', 'offline/sync')).toBe(
      'https://attendance.example/api/v1/schools/school-123/rfid/offline/sync',
    );
  });

  it('fails closed when required URL components are missing', () => {
    expect(() => buildRfidApiUrl('', 'school-123', 'scans')).toThrow('serverBaseUrl is required');
    expect(() => buildRfidApiUrl('https://attendance.example', '', 'scans')).toThrow('schoolId is required');
    expect(() => buildRfidApiUrl('https://attendance.example', 'school-123', '')).toThrow('RFID endpoint is required');
  });

  it('does not fabricate native reader names when the PC/SC socket is unavailable', async () => {
    process.env.PCSCD_SOCKET_PATH = path.join(scratchRoot, 'missing-pcscd.sock');
    const daemon = new GatewayDaemon({
      schoolId: '00000000-0000-0000-0000-000000000001',
      readerId: 'reader-test-01',
      serverBaseUrl: 'http://localhost:3000',
      sharedSecret: 'gateway-test-secret-at-least-32-bytes',
      cardMasterKey: 'gateway-card-key-at-least-32-bytes',
      storageDir: path.join(scratchRoot, 'native'),
      useSimulator: false,
    });

    const diagnostics = await daemon.runDiagnostics();
    expect(diagnostics.status).toBe('SOCKET_UNAVAILABLE');
    expect(diagnostics.readersDetected).toEqual([]);
    expect(diagnostics.nativeLibraryLoaded).toBe(false);
    await daemon.stop();
  });

  it('labels simulated diagnostics explicitly', async () => {
    const daemon = new GatewayDaemon({
      schoolId: '00000000-0000-0000-0000-000000000001',
      readerId: 'reader-test-02',
      serverBaseUrl: 'http://localhost:3000',
      sharedSecret: 'gateway-test-secret-at-least-32-bytes',
      cardMasterKey: 'gateway-card-key-at-least-32-bytes',
      storageDir: path.join(scratchRoot, 'simulated'),
      useSimulator: true,
    });

    const diagnostics = await daemon.runDiagnostics();
    expect(diagnostics.status).toBe('SIMULATION_ACTIVE');
    expect(diagnostics.simulationMode).toBe(true);
    expect(diagnostics.readersDetected).toEqual(['Simulated PC/SC Reader']);
    await daemon.stop();
  });
});
