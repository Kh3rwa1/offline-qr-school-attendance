import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';

declare global {
  interface Window {
    BarcodeDetector?: any;
    __injectedScannerAdapter?: {
      triggerScan: (token: string) => void;
    };
    __scanQRCode?: (token: string) => void;
  }
}

export class CameraScannerService {
  private zxingReader: BrowserMultiFormatReader | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isScanning = false;
  private onScanCallback: ((data: string) => void) | null = null;
  private scanInterval: any = null;

  constructor() {
    this.zxingReader = new BrowserMultiFormatReader();
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onScan: (data: string) => void
  ): Promise<void> {
    this.videoElement = videoElement;
    this.onScanCallback = onScan;
    this.isScanning = true;

    // Attach global test trigger hook if specified
    window.__scanQRCode = (token: string) => {
      if (this.onScanCallback) {
        this.onScanCallback(token);
      }
    };

    if (window.__injectedScannerAdapter) {
      window.__injectedScannerAdapter.triggerScan = (token: string) => {
        if (this.onScanCallback) {
          this.onScanCallback(token);
        }
      };
    }

    try {
      if ('BarcodeDetector' in window) {
        // Use Native BarcodeDetector API if available
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });

        this.scanInterval = setInterval(async () => {
          if (!this.isScanning || !this.videoElement) return;
          try {
            if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
              const barcodes = await barcodeDetector.detect(this.videoElement);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                this.onScanCallback?.(barcodes[0].rawValue);
              }
            }
          } catch (err) {
            // Fallback or retry silently
          }
        }, 250);
      } else {
        // Fallback to ZXing BrowserMultiFormatReader
        await this.zxingReader?.decodeFromVideoDevice(
          undefined,
          videoElement,
          (result, error) => {
            if (result && this.isScanning) {
              this.onScanCallback?.(result.getText());
            }
          }
        );
      }
    } catch (err) {
      console.warn('Camera scan setup note:', err);
    }
  }

  stopScanning(): void {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    try {
      (this.zxingReader as any)?.reset?.();
    } catch (e) {
      // ignore
    }
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
