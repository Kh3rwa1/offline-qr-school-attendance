import {
  ReaderAdapter,
  ReaderMetadata,
  ReaderHealth,
  SecurityCapability,
  ReadOptions,
  ScanEnvelope
} from './types';

export class GatewayAdapter implements ReaderAdapter {
  private connected: boolean = false;
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // TODO: Implement actual connection to local reader gateway process via HTTP/gRPC
    // Support mTLS or signed device credentials
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    // TODO: Implement disconnection logic
    this.connected = false;
  }

  async getHealth(): Promise<ReaderHealth> {
    // TODO: Implement actual health check with the gateway
    return {
      connected: this.connected,
      lastSeenAt: new Date().toISOString(),
      clockDriftMs: 0,
      queueDepth: 0,
      errorCount: 0
    };
  }

  async readCredential(options: ReadOptions): Promise<ScanEnvelope> {
    // TODO: Implement reading from gateway. Handle timeouts and errors appropriately.
    throw new Error('Not implemented: Gateway integration pending.');
  }

  cancelRead(): void {
    // TODO: Cancel any pending read requests to the gateway
  }

  getIdentifier(): string {
    return this.config.readerId || 'unknown-gateway';
  }

  getMetadata(): ReaderMetadata {
    return {
      readerId: this.getIdentifier(),
      deviceId: this.config.deviceId || 'unknown-device',
      adapterType: 'GATEWAY'
    };
  }

  getSecurityCapability(): SecurityCapability {
    return {
      supportsMutualAuth: true,
      supportsDiversifiedKeys: true,
      supportsChallengeResponse: true,
      maxKeyVersion: 1,
      supportedCardTechnologies: ['MIFARE_DESFIRE']
    };
  }
}
