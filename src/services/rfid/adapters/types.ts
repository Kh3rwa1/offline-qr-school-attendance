export type RfidSecurityMode = 'SECURE' | 'UID_LEGACY';
export type DirectionMode = 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL' | 'NONE';
export type AdapterType = 'GATEWAY' | 'USB_HID' | 'WEB_SERIAL' | 'NETWORK';

export interface ReaderMetadata {
  readerId: string;
  deviceId: string;
  model?: string;
  firmwareVersion?: string;
  adapterType: AdapterType;
}

export interface ReaderHealth {
  connected: boolean;
  lastSeenAt?: string;
  clockDriftMs?: number;
  queueDepth?: number;
  errorCount?: number;
}

export interface SecurityCapability {
  supportsMutualAuth: boolean;
  supportsDiversifiedKeys: boolean;
  supportsChallengeResponse: boolean;
  maxKeyVersion: number;
  supportedCardTechnologies: string[];
}

export interface ReadOptions {
  timeoutMs?: number;
  securityMode: RfidSecurityMode;
  sessionContext?: string;
  direction?: DirectionMode;
  signal?: AbortSignal;
  expectedDigest?: string;
  attendanceSessionId?: string;
}

export interface ScanEnvelope {
  version: number;
  schoolId: string;
  readerId: string;
  credentialDigest?: string;
  secureProof?: string;
  readerTimestamp: string;
  sequenceNumber?: number;
  nonce: string;
  direction?: 'ENTRY' | 'EXIT' | 'NONE';
  attendanceSessionId?: string;
  securityMode: RfidSecurityMode;
  signature: string;
  clientEventId: string;
  isOffline?: boolean;
  cardProof?: string;
  cardUid?: string;
  readerChallenge?: string;
  transactionCounter?: number;
}

export interface ReaderAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getHealth(): Promise<ReaderHealth>;
  readCredential(options: ReadOptions): Promise<ScanEnvelope>;
  cancelRead(): void;
  getIdentifier(): string;
  getMetadata(): ReaderMetadata;
  getSecurityCapability(): SecurityCapability;
}

export type AdapterFactory = (config: any) => ReaderAdapter;
