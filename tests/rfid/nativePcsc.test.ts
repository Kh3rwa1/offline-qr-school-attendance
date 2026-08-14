import { describe, it, expect } from 'vitest';
import { NativePcscTransport, SimulatedPcscTransport, PcscAdapter } from '../../src/gateway/pcscAdapter';

describe('Native PC/SC Transport & Adapter Suite', () => {
  it('Instantiates NativePcscTransport with selected reader name', () => {
    const transport = new NativePcscTransport('ACS ACR1252U 0');
    expect(transport.isConnected()).toBe(false);
  });

  it('Fails gracefully with PCSC_NATIVE_UNAVAILABLE or timeout when physical daemon is absent', async () => {
    const transport = new NativePcscTransport('ACS ACR1252U 0', 100);
    await expect(transport.connect()).rejects.toThrow();
  });

  it('SimulatedPcscTransport executes simulated APDU transactions successfully', async () => {
    const sim = new SimulatedPcscTransport(['ACS ACR1252U 0']);
    await sim.connect();
    expect(sim.isConnected()).toBe(true);

    const readers = await sim.listReaders();
    expect(readers).toContain('ACS ACR1252U 0');

    const res = await sim.transceiveApdu({
      cla: 0x00,
      ins: 0xa4,
      p1: 0x04,
      p2: 0x00,
      data: Buffer.from([0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01]),
    });
    expect(res.isSuccess).toBe(true);
    expect(res.sw1).toBe(0x90);
    expect(res.sw2).toBe(0x00);

    await sim.disconnect();
    expect(sim.isConnected()).toBe(false);
  });

  it('PcscAdapter prohibits SimulatedPcscTransport when NODE_ENV is production and useSimulator is requested', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => new PcscAdapter({ useSimulator: true })).toThrow('PCSC_FATAL');
    } finally {
      process.env.NODE_ENV = orig;
    }
  });
});
