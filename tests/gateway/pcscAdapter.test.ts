import { describe, it, expect } from 'vitest';
import { PcscAdapter } from '../../src/gateway/pcscAdapter';

describe('PCSC Edge Reader Gateway Suite', () => {
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

  it('Computes AN10922 diversified key from master key and card UID', () => {
    const pcsc = new PcscAdapter();
    const masterKey = 'master-secret-32-chars-long-env-key';
    const cardUid = '04a1b2c3d4e5f6';
    const systemId = 'school_attendance_system';

    const divKey = pcsc.computeDiversifiedKey(masterKey, cardUid, systemId);
    expect(divKey).toBeInstanceOf(Buffer);
    expect(divKey.length).toBe(16);
  });
});
