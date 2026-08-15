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
  getCardAtr(): Promise<string | null>;
  getReaderName(): string;
}

export class SimulatedPcscTransport implements PcscTransport {
  private connected: boolean = false;
  private cardPresent: boolean = true;
  private readers: string[];
  private activeSimulatedResponse: Buffer | null = null;
  private simulatedSw1: number = 0x91;
  private simulatedSw2: number = 0x00;
  private shouldFailApdu: boolean = false;
  private currentRndB: Buffer | null = null;
  private currentCardUid: string = '04A1B2C3D4E5F6';

  constructor(readerNames?: string[]) {
    this.readers = readerNames || ['ACS ACR1252U 0', 'Omnikey 5422 1'];
  }

  setCardPresent(present: boolean) {
    this.cardPresent = present;
  }

  setSimulatedCardUid(uid: string) {
    this.currentCardUid = uid;
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

  getReaderName(): string {
    return this.readers[0] || 'Simulated DESFire EV2 Reader';
  }

  async isCardPresent(): Promise<boolean> {
    return this.connected && this.cardPresent;
  }

  async getCardAtr(): Promise<string | null> {
    return this.cardPresent ? '3B 81 80 01 80 80' : null;
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
          // Select Application (AID)
          sw1 = 0x90;
          sw2 = 0x00;
          data = Buffer.alloc(0);
        } else if (cmd.ins === 0xca) {
          // ISO Get Card UID
          sw1 = 0x90;
          sw2 = 0x00;
          data = Buffer.from(this.currentCardUid, 'hex');
        } else if (cmd.ins === 0x71) {
          // AuthenticateEV2First: card generates RndB and returns e(RndB)
          this.currentRndB = crypto.randomBytes(16);
          sw1 = 0x91;
          sw2 = 0xaf; // Additional frame expected (DESFire AF)
          data = this.currentRndB; // Card challenge
        } else if (cmd.ins === 0xaf) {
          // AuthenticateEV2NonFirst: card verifies RndB' and returns e(RndA' || TI)
          const ti = crypto.randomBytes(4);
          const rndAPrime = crypto.randomBytes(16);
          sw1 = 0x91;
          sw2 = 0x00; // Success
          data = Buffer.concat([rndAPrime, ti]);
        } else if (cmd.ins === 0xaa) {
          sw1 = 0x91;
          sw2 = 0x7e;
        }

        const isSuccess = (sw1 === 0x91 && sw2 === 0x00) || (sw1 === 0x90 && sw2 === 0x00) || (sw1 === 0x91 && sw2 === 0xaf);
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

/**
 * NativePcscTransport — Production PC/SC transport using pcsclite FFI bindings.
 *
 * Provides real reader enumeration, card-inserted event handling, and APDU exchange
 * via the system's PC/SC daemon (pcscd). Requires the `pcsclite` npm package and
 * a running pcscd service with a connected physical reader.
 *
 * When the native `pcsclite` module is unavailable (e.g., CI runners without
 * libpcsclite-dev), all methods throw PCSC_NATIVE_UNAVAILABLE.
 */
export class NativePcscTransport implements PcscTransport {
  private connected: boolean = false;
  private selectedReader: string;
  private pcsc: any = null;
  private readerHandle: any = null;
  private cardProtocol: number | null = null;
  private availableReaders: Map<string, any> = new Map();
  private cardInserted: boolean = false;
  private timeoutMs: number;

  constructor(readerName?: string, timeoutMs?: number) {
    this.selectedReader = readerName || 'ACS ACR1252U 0';
    this.timeoutMs = timeoutMs || 5000;
  }

  private getPcsclite(): any {
    try {
      // Dynamic require to allow optional dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('pcsclite');
    } catch {
      return null;
    }
  }

  async connect(): Promise<boolean> {
    const pcscliteFactory = this.getPcsclite();
    if (!pcscliteFactory) {
      throw new Error(
        `PCSC_NATIVE_UNAVAILABLE: The 'pcsclite' native module is not installed. ` +
        `Install it with 'npm install pcsclite' and ensure libpcsclite-dev is available on the host.`
      );
    }

    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`PCSC_CONNECT_TIMEOUT: No reader '${this.selectedReader}' detected within ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      try {
        this.pcsc = pcscliteFactory();
      } catch (err: any) {
        clearTimeout(timeout);
        throw new Error(`PCSC_DAEMON_UNAVAILABLE: Failed to connect to PC/SC daemon (pcscd): ${err.message}`);
      }

      this.pcsc.on('reader', (reader: any) => {
        this.availableReaders.set(reader.name, reader);

        reader.on('status', (status: any) => {
          const isPresent = !!(status.state & reader.SCARD_STATE_PRESENT);
          const wasPresent = this.cardInserted;

          if (isPresent && !wasPresent) {
            this.cardInserted = true;
            // Auto-connect to card when it is presented on the selected reader
            if (reader.name === this.selectedReader || this.selectedReader === '*') {
              reader.connect(
                { share_mode: reader.SCARD_SHARE_SHARED },
                (err: any, protocol: number) => {
                  if (err) {
                    this.cardProtocol = null;
                    return;
                  }
                  this.readerHandle = reader;
                  this.cardProtocol = protocol;
                  this.connected = true;
                  clearTimeout(timeout);
                  resolve(true);
                }
              );
            }
          } else if (!isPresent && wasPresent) {
            this.cardInserted = false;
            this.cardProtocol = null;
            this.connected = false;
          }
        });

        reader.on('error', (err: any) => {
          if (!this.connected) {
            clearTimeout(timeout);
            reject(new Error(`PCSC_READER_ERROR: ${err.message}`));
          }
        });

        reader.on('end', () => {
          this.availableReaders.delete(reader.name);
          if (reader.name === this.selectedReader) {
            this.connected = false;
            this.cardProtocol = null;
            this.readerHandle = null;
          }
        });
      });

      this.pcsc.on('error', (err: any) => {
        clearTimeout(timeout);
        reject(new Error(`PCSC_DAEMON_ERROR: ${err.message}`));
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.readerHandle && this.cardProtocol !== null) {
      await new Promise<void>((resolve) => {
        this.readerHandle.disconnect(this.readerHandle.SCARD_LEAVE_CARD, (err: any) => {
          resolve();
        });
      });
    }
    if (this.pcsc) {
      this.pcsc.close();
      this.pcsc = null;
    }
    this.connected = false;
    this.cardProtocol = null;
    this.readerHandle = null;
    this.availableReaders.clear();
  }

  isConnected(): boolean {
    return this.connected && this.cardProtocol !== null;
  }

  async listReaders(): Promise<string[]> {
    return Array.from(this.availableReaders.keys());
  }

  getReaderName(): string {
    return this.selectedReader || (Array.from(this.availableReaders.keys())[0]) || 'Native PC/SC Reader';
  }

  async getCardAtr(): Promise<string | null> {
    if (!this.readerHandle || !this.readerHandle.atr) return null;
    return Buffer.isBuffer(this.readerHandle.atr)
      ? this.readerHandle.atr.toString('hex').toUpperCase().match(/../g)?.join(' ') || null
      : String(this.readerHandle.atr);
  }

  async isCardPresent(): Promise<boolean> {
    return this.connected && this.cardInserted && this.cardProtocol !== null;
  }

  async transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse> {
    if (!this.connected || !this.readerHandle || this.cardProtocol === null) {
      throw new Error('PCSC_NOT_CONNECTED: No active card connection for APDU exchange');
    }
    if (signal?.aborted) {
      throw new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal');
    }

    // Encode APDU command to buffer
    const header = Buffer.from([cmd.cla, cmd.ins, cmd.p1, cmd.p2]);
    let cmdBuf: Buffer;
    if (cmd.data && cmd.data.length > 0) {
      const lc = Buffer.from([cmd.data.length]);
      cmdBuf = cmd.le !== undefined
        ? Buffer.concat([header, lc, cmd.data, Buffer.from([cmd.le])])
        : Buffer.concat([header, lc, cmd.data]);
    } else {
      cmdBuf = cmd.le !== undefined
        ? Buffer.concat([header, Buffer.from([cmd.le])])
        : header;
    }

    const maxResponseLen = 256 + 2; // max data + SW1 SW2
    const reader = this.readerHandle;
    const protocol = this.cardProtocol;

    return new Promise<ApduResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`PCSC_APDU_TIMEOUT: APDU transceive timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal'));
      };
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      reader.transmit(cmdBuf, maxResponseLen, protocol, (err: any, responseBuf: Buffer) => {
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (err) {
          return reject(new Error(`PCSC_APDU_FAILED: ${err.message}`));
        }
        if (!responseBuf || responseBuf.length < 2) {
          return reject(new Error('PCSC_APDU_FAILED: Response too short (missing status words)'));
        }

        const sw1 = responseBuf[responseBuf.length - 2];
        const sw2 = responseBuf[responseBuf.length - 1];
        const data = responseBuf.subarray(0, responseBuf.length - 2);
        const isSuccess = (sw1 === 0x91 && sw2 === 0x00) || (sw1 === 0x90 && sw2 === 0x00);

        resolve({ sw1, sw2, data, isSuccess });
      });
    });
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

  async isCardPresent(): Promise<boolean> {
    return this.transport.isCardPresent();
  }

  getReaderName(): string {
    return this.transport.getReaderName();
  }

  async getCardAtr(): Promise<string | null> {
    return this.transport.getCardAtr();
  }

  getTransport(): PcscTransport {
    return this.transport;
  }

  async transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse> {
    return this.transport.transceiveApdu(cmd, signal);
  }
}
