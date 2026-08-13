import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PcscAdapter, SimulatedPcscTransport, NativePcscTransport } from '../../src/gateway/pcscAdapter';

describe('PCSC Edge Reader Gateway Suite', () => {
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('Successfully connects and transceives APDU command with SW1 SW2 verification', async () => {
    const pcsc = new PcscAdapter({ readerName: 'ACS ACR1252U 0' });
    await pcsc.connect();
    expect(pcsc.isConnected()).toBe(true);

    const selectCmd = { cla: 0x00, ins: 0xa4, p1: 0x04, p2: 0x00 };
    const res = await pcsc.transceiveApdu(selectCmd);

    expect(res.isSuccess).toBe(true);
    expect(res.sw1).toBe(0x90);
    expect(res.sw2).toBe(0x00);

    await pcsc.disconnect();
    expect(pcsc.isConnected()).toBe(false);
  });

  it('Rejects simulator usage in production mode', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new PcscAdapter({ useSimulator: true })).toThrow('PCSC_FATAL');
  });

  it('Throws when reader is not found or hardware unavailable', async () => {
    const simTransport = new SimulatedPcscTransport([]);
    const pcsc = new PcscAdapter({ maxReconnectAttempts: 1, reconnectIntervalMs: 10 }, simTransport);

    await expect(pcsc.connect()).rejects.toThrow('PCSC_CONNECT_FAILED');
  });

  it('Throws when card is removed during APDU transmission', async () => {
    const simTransport = new SimulatedPcscTransport(['ACS ACR1252U 0']);
    const pcsc = new PcscAdapter({}, simTransport);
    await pcsc.connect();

    simTransport.setCardPresent(false);
    const cmd = { cla: 0x90, ins: 0xbd, p1: 0x00, p2: 0x00 };
    await expect(pcsc.transceiveApdu(cmd)).rejects.toThrow('CARD_REMOVED');
  });

  it('Detects APDU status error response (0x91 0x7E)', async () => {
    const pcsc = new PcscAdapter();
    await pcsc.connect();

    const errCmd = { cla: 0x90, ins: 0xaa, p1: 0x00, p2: 0x00 };
    const res = await pcsc.transceiveApdu(errCmd);

    expect(res.isSuccess).toBe(false);
    expect(res.sw1).toBe(0x91);
    expect(res.sw2).toBe(0x7e);

    await pcsc.disconnect();
  });

  it('Aborts active APDU command when AbortSignal fires', async () => {
    const pcsc = new PcscAdapter();
    await pcsc.connect();

    const abortController = new AbortController();
    const cmd = { cla: 0x90, ins: 0xbd, p1: 0x00, p2: 0x00 };

    const promise = pcsc.transceiveApdu(cmd, abortController.signal);
    abortController.abort();

    await expect(promise).rejects.toThrow('READ_CANCELLED');
    await pcsc.disconnect();
  });
});
