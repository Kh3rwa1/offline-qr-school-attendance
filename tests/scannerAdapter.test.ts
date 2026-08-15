/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraScannerService, setupUSBScannerListener } from '../src/services/scannerService';

describe('Injected Scanner Adapter & USB Wedge Integration', () => {
  beforeEach(() => {
    delete window.__injectedScannerAdapter;
    delete window.__scanQRCode;
    document.body.innerHTML = '';

    const mockTrack = { stop: vi.fn(), kind: 'video' };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it('connects injected scanner adapter for simulated camera scanning in automated test environments', async () => {
    const scannerService = new CameraScannerService();
    const scanSpy = vi.fn();

    window.__injectedScannerAdapter = {
      triggerScan: () => {},
    };

    const mockVideo = document.createElement('video');
    (scannerService as any).zxingReader = {
      decodeFromStream: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
    };
    await scannerService.startScanning(mockVideo, scanSpy);

    // Verify injected adapter hook was attached
    expect(window.__scanQRCode).toBeDefined();
    expect(window.__injectedScannerAdapter.triggerScan).toBeDefined();

    // Trigger simulated camera scan via window.__scanQRCode
    window.__scanQRCode?.('TEST_TOKEN_XYZ_123');
    expect(scanSpy).toHaveBeenCalledWith('TEST_TOKEN_XYZ_123');

    // Trigger via injected adapter
    window.__injectedScannerAdapter.triggerScan('TEST_TOKEN_ABC_789');
    expect(scanSpy).toHaveBeenCalledWith('TEST_TOKEN_ABC_789');

    scannerService.stopScanning();
  });

  it('buffers fast hardware keystrokes and emits scan event on Enter key', async () => {
    const usbScanSpy = vi.fn();
    const cleanup = setupUSBScannerListener(usbScanSpy, 100);

    // Simulate rapid keystrokes from USB hardware wedge scanner
    const tokenChars = 'QR-STUDENT-TOKEN-999'.split('');
    const now = Date.now();

    for (let i = 0; i < tokenChars.length; i++) {
      const event = new KeyboardEvent('keydown', {
        key: tokenChars[i],
        bubbles: true,
      });
      window.dispatchEvent(event);
    }

    // Dispatch Enter key
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    window.dispatchEvent(enterEvent);

    expect(usbScanSpy).toHaveBeenCalledWith('QR-STUDENT-TOKEN-999');

    cleanup();
  });
});
