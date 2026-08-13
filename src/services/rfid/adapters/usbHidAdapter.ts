import {
  ReaderAdapter,
  ReaderMetadata,
  ReaderHealth,
  SecurityCapability,
  ReadOptions,
  ScanEnvelope
} from './types';

// PROTOTYPE / LEGACY ONLY
export class UsbHidAdapter implements ReaderAdapter {
  private connected: boolean = false;
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getHealth(): Promise<ReaderHealth> {
    return {
      connected: this.connected
    };
  }

  public validateInput(input: string): boolean {
    if (!input || input.length > 32) return false;
    // Only hex allowed, reject non-hex, control characters, shell metacharacters
    const hexRegex = /^[0-9A-Fa-f]+$/;
    return hexRegex.test(input);
  }

  async readCredential(options: ReadOptions): Promise<ScanEnvelope> {
    // Note: USB HID usually acts as a keyboard. This would typically be handled
    // at the UI layer (listening to keydown events) rather than directly here.
    // If we handle it here, it requires some OS-level hooking, which is outside browser scope.
    throw new Error('Not implemented: USB HID usually requires UI event listener or OS integration.');
  }

  cancelRead(): void {}

  getIdentifier(): string {
    return this.config.readerId || 'unknown-usb-hid';
  }

  getMetadata(): ReaderMetadata {
    return {
      readerId: this.getIdentifier(),
      deviceId: this.config.deviceId || 'unknown-device',
      adapterType: 'USB_HID'
    };
  }

  getSecurityCapability(): SecurityCapability {
    return {
      supportsMutualAuth: false,
      supportsDiversifiedKeys: false,
      supportsChallengeResponse: false,
      maxKeyVersion: 0,
      supportedCardTechnologies: ['UID_ONLY']
    };
  }
}
