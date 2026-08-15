import { BrowserMultiFormatReader } from '@zxing/browser';

declare global {
  interface Window {
    BarcodeDetector?: any;
    __ENABLE_TEST_SCANNER_HOOK?: boolean;
    __injectedScannerAdapter?: {
      triggerScan: (token: string) => void;
    };
    __scanQRCode?: (token: string) => void;
  }
}

export class CameraScannerService {
  private zxingReader: BrowserMultiFormatReader | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private isScanning = false;
  private onScanCallback: ((data: string) => void) | null = null;
  private scanInterval: any = null;
  private lastScanToken = '';
  private lastScanTime = 0;

  constructor() {
    this.zxingReader = new BrowserMultiFormatReader();
  }

  private emitScan(token: string) {
    const trimmed = token.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (trimmed === this.lastScanToken && now - this.lastScanTime < 1500) {
      return;
    }
    this.lastScanToken = trimmed;
    this.lastScanTime = now;
    this.onScanCallback?.(trimmed);
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onScan: (data: string) => void
  ): Promise<void> {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('CAMERA_UNAVAILABLE: getUserMedia is not supported in this browser environment.');
    }

    // Stop any existing stream / loop before starting new stream
    this.stopScanning();

    this.videoElement = videoElement;
    this.onScanCallback = onScan;
    this.isScanning = true;

    // 1. Request environment-facing camera media stream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    this.mediaStream = stream;

    // 2. Assign stream to video element and await playback
    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = true;
    await videoElement.play();

    // 3. Expose test hooks only in test mode or when explicitly enabled
    if (typeof window !== 'undefined') {
      const isTestEnv =
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
        (import.meta as any)?.env?.MODE === 'test' ||
        window.__ENABLE_TEST_SCANNER_HOOK === true;

      if (isTestEnv) {
        window.__scanQRCode = (token: string) => {
          this.emitScan(token);
        };

        if (!window.__injectedScannerAdapter) {
          window.__injectedScannerAdapter = {
            triggerScan: (token: string) => this.emitScan(token),
          };
        } else {
          window.__injectedScannerAdapter.triggerScan = (token: string) => this.emitScan(token);
        }
      }
    }

    // 4. Optical detection loop
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });

        this.scanInterval = setInterval(async () => {
          if (!this.isScanning || !this.videoElement) return;
          try {
            if (this.videoElement.readyState >= 2) {
              const barcodes = await barcodeDetector.detect(this.videoElement);
              if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                this.emitScan(barcodes[0].rawValue);
              }
            }
          } catch {
            // Transient frame detection error, continue loop
          }
        }, 150);
        return;
      } catch (detectorErr) {
        console.warn('BarcodeDetector initialization fallback to ZXing:', detectorErr);
      }
    }

    // Fallback: ZXing BrowserMultiFormatReader decoding directly from video stream
    if (!this.zxingReader) {
      this.zxingReader = new BrowserMultiFormatReader();
    }

    await this.zxingReader.decodeFromStream(
      stream,
      videoElement,
      (result) => {
        if (result && this.isScanning) {
          this.emitScan(result.getText());
        }
      }
    );
  }

  stopScanning(): void {
    this.isScanning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }

    if (this.zxingReader) {
      try {
        (this.zxingReader as any).reset?.();
      } catch {
        // ignore
      }
    }

    if (this.videoElement) {
      try {
        this.videoElement.srcObject = null;
      } catch {
        // ignore
      }
      this.videoElement = null;
    }

    this.lastScanToken = '';
    this.lastScanTime = 0;
  }
}

/**
 * USB Keyboard-Wedge Scanner Listener
 * Hardware barcode scanners act as rapid key input devices ending with Enter (Key 13).
 */
export function setupUSBScannerListener(
  onScan: (scannedText: string) => void,
  maxInterKeyDelayMs = 40
): () => void {
  let keyBuffer: string[] = [];
  let lastKeyTime = 0;

  const handleKeyDown = (event: KeyboardEvent) => {
    // Ignore keypresses if user is typing into standard inputs/textareas
    const activeElement = document.activeElement;
    const isInputElement =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable);

    // If typing inside an input field, only intercept if rapid keystrokes indicate a USB hardware scanner
    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;

    if (event.key === 'Enter') {
      if (keyBuffer.length >= 3 && timeDiff < 100) {
        const scannedText = keyBuffer.join('').trim();
        if (scannedText.length > 0) {
          event.preventDefault();
          onScan(scannedText);
        }
      }
      keyBuffer = [];
      return;
    }

    if (event.key.length === 1) {
      // Single character
      if (timeDiff > maxInterKeyDelayMs && !isInputElement) {
        // Reset buffer if delay too long unless not in an input field
        keyBuffer = [];
      }
      keyBuffer.push(event.key);
      lastKeyTime = currentTime;
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
