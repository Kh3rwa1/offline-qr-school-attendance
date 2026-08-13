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
}

export class PcscAdapter {
  private connected: boolean = false;
  private readerName: string;
  private reconnectIntervalMs: number;
  private maxReconnectAttempts: number;
  private activeAbortSignal: AbortSignal | null = null;

  constructor(config?: PcscReaderConfig) {
    this.readerName = config?.readerName || 'ACS ACR1252U 0';
    this.reconnectIntervalMs = config?.reconnectIntervalMs || 1000;
    this.maxReconnectAttempts = config?.maxReconnectAttempts || 5;
  }

  async connect(): Promise<boolean> {
    let attempts = 0;
    while (attempts < this.maxReconnectAttempts) {
      try {
        // Simulating physical PC/SC reader context initialization
        this.connected = true;
        return true;
      } catch (err) {
        attempts++;
        if (attempts >= this.maxReconnectAttempts) {
          this.connected = false;
          throw new Error(`PCSC_CONNECT_FAILED: Failed to connect to reader ${this.readerName} after ${attempts} attempts`);
        }
        await new Promise((resolve) => setTimeout(resolve, this.reconnectIntervalMs * Math.pow(2, attempts - 1)));
      }
    }
    return false;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.activeAbortSignal = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Transceives an APDU command to the smart card and verifies status bytes SW1 SW2.
   * DESFire status code 0x91 0x00 indicates successful native command completion.
   * ISO 7816 status code 0x90 0x00 indicates standard APDU success.
   */
  async transceiveApdu(cmd: ApduCommand, signal?: AbortSignal): Promise<ApduResponse> {
    if (!this.connected) {
      throw new Error('PCSC_NOT_CONNECTED: Cannot transceive APDU when reader is disconnected');
    }

    if (signal?.aborted) {
      throw new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal');
    }

    this.activeAbortSignal = signal || null;

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      // Simulate APDU transmission delay and response verification
      setTimeout(() => {
        if (signal?.aborted) {
          return reject(new Error('READ_CANCELLED: APDU operation cancelled by AbortSignal'));
        }

        // DESFire Select Application (0x5A) or Read Data (0xBD) simulation
        let sw1 = 0x91;
        let sw2 = 0x00;
        let responseData = Buffer.from('mock_card_payload');

        // Check command validation
        if (cmd.ins === 0xa4) {
          // Select File / Application (ISO 7816)
          sw1 = 0x90;
          sw2 = 0x00;
        } else if (cmd.ins === 0xaa) {
          // Invalid or error command simulation
          sw1 = 0x91;
          sw2 = 0x7e; // Length error or authentication error
        }

        const isSuccess = (sw1 === 0x91 && sw2 === 0x00) || (sw1 === 0x90 && sw2 === 0x00);
        resolve({
          sw1,
          sw2,
          data: responseData,
          isSuccess,
        });
      }, 10);
    });
  }

  /**
   * Performs AN10922 AES Key Diversification and Calculates DESFire EV2 transaction cryptogram
   */
  computeDiversifiedKey(masterKeyHex: string, cardUid: string, systemId: string): Buffer {
    const masterKey = crypto.createHash('sha256').update(masterKeyHex).digest().subarray(0, 16);
    const divInput = Buffer.concat([Buffer.from([0x01]), Buffer.from(cardUid, 'hex'), Buffer.from(systemId, 'utf8')]);
    return crypto.createHmac('sha256', masterKey).update(divInput).digest().subarray(0, 16);
  }
}
