import { describe, it, expect, beforeAll } from 'vitest';
import { GatewayAdapter } from '../../src/services/rfid/adapters/gatewayAdapter';
import { SimulatedPcscTransport } from '../../src/gateway/pcscAdapter';
import { verifyEnvelopeSignature, verifyCardProof } from '../../src/services/rfid/cryptoService';

describe('GatewayAdapter Native PC/SC and Card Proof Pipeline', () => {
  const schoolId = '00000000-0000-0000-0000-000000000001';
  const sharedSecret = 'test-secret-32-chars-length-environment';
  const cardMasterKey = 'test-card-master-key-32-chars-environment';

  let transport: SimulatedPcscTransport;
  let adapter: GatewayAdapter;

  beforeAll(() => {
    process.env.RFID_HMAC_SECRET = sharedSecret;
    process.env.RFID_CARD_MASTER_KEY = cardMasterKey;
    process.env.NODE_ENV = 'test';

    transport = new SimulatedPcscTransport(['ACS ACR1252U 0']);
    adapter = new GatewayAdapter({
      schoolId,
      readerId: 'gw_reader_test_01',
      deviceId: 'acr1252u_test',
      sharedSecret,
      cardMasterKey,
      pcscTransport: transport,
    });
  });

  it('connects to hardware subsystem and reports healthy state', async () => {
    await adapter.connect();
    const health = await adapter.getHealth();
    expect(health.connected).toBe(true);
    expect(health.errorCount).toBe(0);
  });

  it('reads card credential via APDU transceive and generates valid card proof & signature', async () => {
    // Simulate ISO 14443-4 UID response: 7-byte UID 04A1B2C3D4E5F6 + 9000
    const cardUidBuffer = Buffer.from('04A1B2C3D4E5F6', 'hex');
    transport.setSimulatedResponse(cardUidBuffer, 0x90, 0x00);

    const envelope = await adapter.readCredential({
      securityMode: 'SECURE',
      attendanceSessionId: 'sess_123',
    });

    expect(envelope.schoolId).toBe(schoolId);
    expect(envelope.readerId).toBe('gw_reader_test_01');
    expect(envelope.cardUid).toBe('04a1b2c3d4e5f6');
    expect(envelope.cardProof).toBeDefined();
    expect(envelope.readerChallenge).toBeDefined();
    expect(envelope.transactionCounter).toBe(1);
    expect(envelope.signature).toBeDefined();

    // Verify canonical envelope signature
    const isValidSignature = verifyEnvelopeSignature(envelope, envelope.signature, sharedSecret);
    expect(isValidSignature).toBe(true);

    // Verify card-originated AES-CMAC proof
    const isValidCardProof = verifyCardProof({
      cardUidHex: envelope.cardUid!,
      readerChallengeHex: envelope.readerChallenge!,
      transactionCounter: envelope.transactionCounter!,
      cardProofHex: envelope.cardProof!,
      masterKeyHex: cardMasterKey,
    });
    expect(isValidCardProof).toBe(true);
  });

  it('increments transactionCounter and sequenceNumber on subsequent reads', async () => {
    const env2 = await adapter.readCredential({
      securityMode: 'SECURE',
    });
    expect(env2.transactionCounter).toBe(2);
    expect(env2.sequenceNumber).toBe(2);
  });

  it('disconnects cleanly', async () => {
    await adapter.disconnect();
    const health = await adapter.getHealth();
    expect(health.connected).toBe(false);
  });
});
