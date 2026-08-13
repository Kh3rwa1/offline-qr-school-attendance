import {
  ReaderAdapter,
  ReaderMetadata,
  ReaderHealth,
  SecurityCapability,
  ReadOptions,
  ScanEnvelope
} from './types';

// EXPERIMENTAL BROWSER ADAPTER
export class WebSerialAdapter implements ReaderAdapter {
  private connected: boolean = false;
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Requires browser environment and navigator.serial
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      throw new Error('Web Serial API not supported in this environment');
    }
    // TODO: Handle browser permission requests and port opening
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
    const hexRegex = /^[0-9A-Fa-f]+$/;
    return hexRegex.test(input);
  }

  async readCredential(options: ReadOptions): Promise<ScanEnvelope> {
    throw new Error('Not implemented: Web Serial reading pending.');
  }

  cancelRead(): void {}

  getIdentifier(): string {
    return this.config.readerId || 'unknown-web-serial';
  }

  getMetadata(): ReaderMetadata {
    return {
      readerId: this.getIdentifier(),
      deviceId: this.config.deviceId || 'unknown-device',
      adapterType: 'WEB_SERIAL'
    };
  }

  getSecurityCapability(): SecurityCapability {
    return {
      supportsMutualAuth: false, // Potentially upgradeable depending on reader firmware
      supportsDiversifiedKeys: false,
      supportsChallengeResponse: false,
      maxKeyVersion: 0,
      supportedCardTechnologies: ['UID_ONLY']
    };
  }
}
