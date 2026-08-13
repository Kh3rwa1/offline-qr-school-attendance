import crypto from 'crypto';

export interface KMSConfig {
  masterSecret?: string;
  keyVersion?: number;
}

export class KMSService {
  private masterSecret: string;
  private keyVersion: number;

  constructor(config?: KMSConfig) {
    let secret = config?.masterSecret || process.env.RFID_HMAC_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'test') {
        secret = 'test-secret-32-chars-length-environment';
      } else {
        throw new Error('KMS_FATAL: RFID_HMAC_SECRET master key must be configured in environment');
      }
    }

    if (secret.length < 32 && process.env.NODE_ENV !== 'test') {
      throw new Error('KMS_FATAL: Master key must be at least 32 bytes (256 bits) for production security');
    }

    this.masterSecret = secret;
    this.keyVersion = config?.keyVersion || 1;
  }

  /**
   * AES-256-GCM Envelope Encryption for reader shared secrets.
   */
  encryptSecret(plainSecret: string): string {
    if (!plainSecret) throw new Error('KMS_ERROR: Cannot encrypt empty secret');
    const masterKey = crypto.createHash('sha256').update(this.masterSecret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * AES-256-GCM Envelope Decryption.
   */
  decryptSecret(encryptedStr: string): string {
    if (!encryptedStr) throw new Error('KMS_ERROR: Cannot decrypt empty payload');
    try {
      const masterKey = crypto.createHash('sha256').update(this.masterSecret).digest();
      const parts = encryptedStr.split(':');
      if (parts.length !== 3) {
        return encryptedStr;
      }
      const [ivHex, tagHex, cipherHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const cipherText = Buffer.from(cipherHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
      decipher.setAuthTag(tag);
      return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
    } catch (err: any) {
      throw new Error(`KMS_DECRYPT_FAILED: Decryption failed or tag mismatch: ${err.message}`);
    }
  }

  /**
   * Generates Ed25519 KeyPair for offline roster signing.
   */
  generateEd25519KeyPair(): { publicKeyPem: string; privateKeyPem: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
  }

  /**
   * Signs offline roster payload with Ed25519 private key.
   */
  signOfflineRoster(payload: string, privateKeyPem: string): string {
    const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKeyPem);
    return signature.toString('hex');
  }

  /**
   * Verifies offline roster payload Ed25519 signature.
   */
  verifyOfflineRosterSignature(payload: string, signatureHex: string, publicKeyPem: string): boolean {
    try {
      return crypto.verify(
        null,
        Buffer.from(payload, 'utf8'),
        publicKeyPem,
        Buffer.from(signatureHex, 'hex')
      );
    } catch {
      return false;
    }
  }

  getKeyVersion(): number {
    return this.keyVersion;
  }
}

export const defaultKmsService = new KMSService();
