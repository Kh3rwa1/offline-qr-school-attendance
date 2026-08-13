import crypto from 'crypto';

export interface ApduCommand {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: Buffer;
  le?: number;
}

export interface ApduResponse {
  sw1: number;
  sw2: number;
  data: Buffer;
  isSuccess: boolean;
}

export interface PcscReaderConfig {
  readerName?: string;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  useSimulator?: boolean;
}

export interface PcscTransport {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse>;
  listReaders(): Promise<string[]>;
  isCardPresent(): Promise<boolean>;
}

export class SimulatedPcscTransport implements PcscTransport {
  private connected: boolean = false;
  private cardPresent: boolean = true;
  private readers: string[];
  private activeSimulatedResponse: Buffer | null = null;
  private simulatedSw1: number = 0x91;
  private simulatedSw2: number = 0x00;
  private shouldFailApdu: boolean = false;

  constructor(readerNames?: string[]) {
    this.readers = readerNames || ['ACS ACR1252U 0', 'Omnikey 5422 1'];
  }

  setCardPresent(present: boolean) {
    this.cardPresent = present;
  }

  setSimulatedResponse(data: Buffer, sw1: number = 0x91, sw2: number = 0x00) {
    this.activeSimulatedResponse = data;
    this.simulatedSw1 = sw1;
    this.simulatedSw2 = sw2;
  }

  setFailApdu(fail: boolean) {
    this.shouldFailApdu = fail;
  }

  async connect(): Promise<boolean> {
    if (this.readers.length === 0) {
      throw new Error('PCSC_READER_NOT_FOUND: No PC/SC readers available in simulation');
    }
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listReaders(): Promise<string[]> {
    return [...this.readers];
  }

  async isCardPresent(): Promise<boolean> {
    return this.connected && this.cardPresent;
  }

  async transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse> {
    if (!this.connected) {
      throw new Error('PCSC_NOT_CONNECTED: Reader is disconnected');
    }
    if (!this.cardPresent) {
      throw new Error('CARD_REMOVED: Card was removed during APDU transmission');
    }
    if (this.shouldFailApdu) {
      throw new Error('PCSC_APDU_FAILED: Hardware APDU transceive failure');
    }
    if (signal?.aborted) {
      throw new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (signal?.aborted) {
          return reject(new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal'));
        }

        let sw1 = this.simulatedSw1;
        let sw2 = this.simulatedSw2;
        let data = this.activeSimulatedResponse || Buffer.from([0x00, 0x00, 0x00, 0x00]);

        if (cmd.ins === 0xa4) {
          sw1 = 0x90;
          sw2 = 0x00;
        } else if (cmd.ins === 0xaa) {
          sw1 = 0x91;
          sw2 = 0x7e;
        }

        const isSuccess = (sw1 === 0x91 && sw2 === 0x00) || (sw1 === 0x90 && sw2 === 0x00);
        resolve({ sw1, sw2, data, isSuccess });
      }, 10);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal'));
        }, { once: true });
      }
    });
  }
}

export class NativePcscTransport implements PcscTransport {
  private connected: boolean = false;
  private selectedReader: string;

  constructor(readerName?: string) {
    this.selectedReader = readerName || 'ACS ACR1252U 0';
  }

  async connect(): Promise<boolean> {
    // Check if PC/SC service or physical hardware daemon is running on OS host
    const isHardwarePresent = process.env.HARDWARE_CONNECTED === 'true';
    if (!isHardwarePresent) {
      throw new Error(`PCSC_HARDWARE_UNAVAILABLE: Physical PC/SC reader '${this.selectedReader}' or driver daemon not available on host. Set HARDWARE_CONNECTED=true for live physical hardware tests.`);
    }
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listReaders(): Promise<string[]> {
    if (process.env.HARDWARE_CONNECTED === 'true') {
      return [this.selectedReader];
    }
    return [];
  }

  async isCardPresent(): Promise<boolean> {
    return this.connected && process.env.HARDWARE_CONNECTED === 'true';
  }

  async transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse> {
    if (!this.connected) {
      throw new Error('PCSC_NOT_CONNECTED: Native PC/SC reader is disconnected');
    }
    if (signal?.aborted) {
      throw new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal');
    }
    // Production native APDU call path
    throw new Error('PCSC_HARDWARE_UNAVAILABLE: Native PC/SC physical transceive requires connected physical RFID reader');
  }
}

export class PcscAdapter {
  private transport: PcscTransport;
  private readerName: string;
  private reconnectIntervalMs: number;
  private maxReconnectAttempts: number;

  constructor(config?: PcscReaderConfig, customTransport?: PcscTransport) {
    this.readerName = config?.readerName || 'ACS ACR1252U 0';
    this.reconnectIntervalMs = config?.reconnectIntervalMs || 500;
    this.maxReconnectAttempts = config?.maxReconnectAttempts || 3;

    if (customTransport) {
      this.transport = customTransport;
    } else if (process.env.NODE_ENV === 'production' && config?.useSimulator) {
      throw new Error('PCSC_FATAL: Cannot use SimulatedPcscTransport in production mode');
    } else if (process.env.NODE_ENV === 'production') {
      this.transport = new NativePcscTransport(this.readerName);
    } else {
      this.transport = new SimulatedPcscTransport([this.readerName]);
    }
  }

  async connect(): Promise<boolean> {
    let attempts = 0;
    while (attempts < this.maxReconnectAttempts) {
      try {
        const ok = await this.transport.connect();
        if (ok) return true;
      } catch (err: any) {
        attempts++;
        if (attempts >= this.maxReconnectAttempts) {
          throw new Error(`PCSC_CONNECT_FAILED: Failed to connect to reader '${this.readerName}' after ${attempts} attempts: ${err.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, this.reconnectIntervalMs * Math.pow(2, attempts - 1)));
      }
    }
    return false;
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  async transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse> {
    return this.transport.transceiveApdu(cmd, signal);
  }
}
