import crypto from 'crypto';
import { KmsProvider, LocalKmsProvider, CloudKmsProviderAdapter } from './kmsProvider';

export type CryptoKeyPurpose =
  | 'RFID_READER_HMAC_KEY'
  | 'RFID_CREDENTIAL_DIGEST_KEY'
  | 'RFID_OUTBOX_ENCRYPTION_KEY'
  | 'ROSTER_SIGNING_PRIVATE_KEY'
  | 'ROSTER_SIGNING_PUBLIC_KEY'
  | 'DATABASE_ENCRYPTION_KEK'
  | 'REDIS_KEY_HMAC_SECRET'
  | 'SESSION_SECRET'
  | 'MTLS_PRIVATE_KEY';

export interface VersionedCiphertextEnvelope {
  version: number;
  algorithm: string;
  kmsKeyId: string;
  encryptedDataKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
  createdAt: string;
  keyVersion: number;
}

export interface KMSConfig {
  kmsProvider?: KmsProvider;
  purposeSecrets?: Partial<Record<CryptoKeyPurpose, string>>;
  keyVersion?: number;
}

export class KMSService {
  private provider: KmsProvider;
  private purposeSecrets: Map<CryptoKeyPurpose, string> = new Map();
  private keyVersion: number;

  constructor(config?: KMSConfig) {
    this.keyVersion = config?.keyVersion || 1;

    const rawMasterKms = process.env.KMS_MASTER_KEY;
    let rawMaster = rawMasterKms;
    if (!rawMaster && process.env.RFID_HMAC_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('KMS_SECRET_MISSING: Refusing to fall back to RFID_HMAC_SECRET in production mode.');
      }
      rawMaster = process.env.RFID_HMAC_SECRET;
    }

    if (process.env.NODE_ENV === 'production' && !rawMaster && !config?.purposeSecrets && !config?.kmsProvider) {
      throw new Error('KMS_FATAL: Production mode requires configured KMS provider or KMS master secret');
    }

    if (process.env.NODE_ENV === 'production' && rawMaster && rawMaster.length < 32) {
      throw new Error('KMS_FATAL: Master KMS key must be at least 32 bytes (256 bits)');
    }

    if (process.env.NODE_ENV === 'production' && config?.purposeSecrets) {
      for (const [p, secretVal] of Object.entries(config.purposeSecrets)) {
        if (secretVal && secretVal.length < 32) {
          throw new Error(`KMS_FATAL: Purpose key '${p}' must be at least 32 bytes`);
        }
      }
    }

    const testMaster = rawMaster || (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);

    if (config?.kmsProvider) {
      this.provider = config.kmsProvider;
    } else if (process.env.NODE_ENV === 'production' && !config?.purposeSecrets) {
      this.provider = new CloudKmsProviderAdapter();
    } else {
      const defaultSecrets: Record<string, string> = {};
      const purposes: CryptoKeyPurpose[] = [
        'RFID_READER_HMAC_KEY',
        'RFID_CREDENTIAL_DIGEST_KEY',
        'RFID_OUTBOX_ENCRYPTION_KEY',
        'ROSTER_SIGNING_PRIVATE_KEY',
        'ROSTER_SIGNING_PUBLIC_KEY',
        'DATABASE_ENCRYPTION_KEK',
        'REDIS_KEY_HMAC_SECRET',
        'SESSION_SECRET',
        'MTLS_PRIVATE_KEY',
      ];
      for (const p of purposes) {
        const custom = config?.purposeSecrets?.[p] || process.env[p];
        const secretVal = custom || (testMaster ? `${testMaster}-${p}` : undefined);
        if (secretVal) {
          if (secretVal.length < 32 && process.env.NODE_ENV === 'production') {
            throw new Error(`KMS_FATAL: Purpose key '${p}' must be at least 32 bytes`);
          }
          defaultSecrets[p] = secretVal;
          this.purposeSecrets.set(p, secretVal);
        }
      }
      this.provider = new LocalKmsProvider(defaultSecrets, this.keyVersion);
    }
  }

  /**
   * Encrypts plaintext payload using versioned envelope encryption with data key.
   */
  async encryptEnvelope(purpose: CryptoKeyPurpose, plainText: string): Promise<string> {
    if (!plainText) throw new Error('KMS_ERROR: Cannot encrypt empty payload');

    const dataKey = crypto.randomBytes(32);
    const dataIv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, dataIv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const dataKeyResult = await this.provider.encryptDataKey(purpose, dataKey);

    const envelope: VersionedCiphertextEnvelope = {
      version: 1,
      algorithm: 'AES-256-GCM',
      kmsKeyId: purpose,
      encryptedDataKey: dataKeyResult.encryptedDataKeyHex,
      iv: dataIv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      createdAt: new Date().toISOString(),
      keyVersion: this.keyVersion,
    };

    return JSON.stringify(envelope);
  }

  /**
   * Decrypts versioned ciphertext envelope. Throws stable error on malformed or unauthenticated ciphertext.
   */
  async decryptEnvelope(envelopeJsonOrStr: string): Promise<string> {
    if (!envelopeJsonOrStr || typeof envelopeJsonOrStr !== 'string') {
      throw new Error('KMS_DECRYPT_FAILED: Ciphertext envelope is empty or invalid type');
    }

    let envelope: VersionedCiphertextEnvelope;
    try {
      if (envelopeJsonOrStr.startsWith('{')) {
        envelope = JSON.parse(envelopeJsonOrStr);
      } else {
        // Fallback format parsing iv:tag:ciphertext
        const parts = envelopeJsonOrStr.split(':');
        if (parts.length !== 3) {
          throw new Error('KMS_DECRYPT_FAILED: Invalid envelope format');
        }
        const [ivHex, tagHex, cipherHex] = parts;
        envelope = {
          version: 1,
          algorithm: 'AES-256-GCM',
          kmsKeyId: 'DATABASE_ENCRYPTION_KEK',
          encryptedDataKey: '',
          iv: ivHex,
          tag: tagHex,
          ciphertext: cipherHex,
          createdAt: new Date().toISOString(),
          keyVersion: 1,
        };
      }
    } catch (err: any) {
      throw new Error(`KMS_DECRYPT_FAILED: Malformed ciphertext envelope or unparseable JSON: ${err.message}`);
    }

    if (!envelope.iv || !envelope.tag || !envelope.ciphertext) {
      throw new Error('KMS_DECRYPT_FAILED: Missing required cryptographic components in envelope');
    }

    try {
      let dataKey: Buffer;
      if (envelope.encryptedDataKey) {
        dataKey = await this.provider.decryptDataKey(envelope.kmsKeyId, envelope.encryptedDataKey, envelope.keyVersion);
      } else {
        // Local fallback key for legacy format
        let purposeSecret = this.purposeSecrets.get(envelope.kmsKeyId as CryptoKeyPurpose);
        if (!purposeSecret) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('KMS_SECRET_MISSING: Refusing to fall back to RFID_HMAC_SECRET in production mode.');
          }
          purposeSecret = process.env.RFID_HMAC_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
        }
        if (!purposeSecret) throw new Error('KMS_FATAL: Required cryptographic secret is missing in server configuration');
        dataKey = Buffer.from(crypto.hkdfSync('sha256', purposeSecret, 'kms-salt', `kms-provider-${envelope.kmsKeyId}`, 32));
      }

      const iv = Buffer.from(envelope.iv, 'hex');
      const tag = Buffer.from(envelope.tag, 'hex');
      const cipherText = Buffer.from(envelope.ciphertext, 'hex');

      if (iv.length !== 12 || tag.length !== 16) {
        throw new Error('KMS_DECRYPT_FAILED: Invalid IV or Auth Tag length');
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
      decipher.setAuthTag(tag);
      return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
    } catch (err: any) {
      throw new Error(`KMS_DECRYPT_FAILED: Authentication tag mismatch or key decryption failed: ${err.message}`);
    }
  }

  /**
   * Synchronous helper for legacy call sites (uses local purpose key).
   */
  encryptSecret(plainSecret: string, purpose: CryptoKeyPurpose = 'DATABASE_ENCRYPTION_KEK'): string {
    if (!plainSecret) throw new Error('KMS_ERROR: Cannot encrypt empty secret');
    let secret = this.purposeSecrets.get(purpose);
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('KMS_SECRET_MISSING: Refusing to fall back to RFID_HMAC_SECRET in production mode.');
      }
      secret = process.env.RFID_HMAC_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
    }
    if (!secret) throw new Error('KMS_FATAL: Required cryptographic secret is missing in server configuration');
    const key = Buffer.from(crypto.hkdfSync('sha256', secret, 'kms-salt', `kms-secret-${purpose}`, 32));
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptSecret(encryptedStr: string, purpose: CryptoKeyPurpose = 'DATABASE_ENCRYPTION_KEK'): string {
    if (!encryptedStr || typeof encryptedStr !== 'string') {
      throw new Error('KMS_DECRYPT_FAILED: Payload empty or invalid');
    }
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new Error('KMS_DECRYPT_FAILED: Invalid envelope format (requires 3 parts)');
    }
    const [ivHex, tagHex, cipherHex] = parts;
    if (!ivHex || !tagHex || !cipherHex) {
      throw new Error('KMS_DECRYPT_FAILED: Truncated or empty envelope components');
    }
    try {
      let secret = this.purposeSecrets.get(purpose);
      if (!secret) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('KMS_SECRET_MISSING: Refusing to fall back to RFID_HMAC_SECRET in production mode.');
        }
        secret = process.env.RFID_HMAC_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
      }
      if (!secret) throw new Error('KMS_FATAL: Required cryptographic secret is missing in server configuration');
      const key = Buffer.from(crypto.hkdfSync('sha256', secret, 'kms-salt', `kms-secret-${purpose}`, 32));
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const cipherText = Buffer.from(cipherHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
    } catch (err: any) {
      throw new Error(`KMS_DECRYPT_FAILED: Authentication tag mismatch: ${err.message}`);
    }
  }

  generateEd25519KeyPair(): { publicKeyPem: string; privateKeyPem: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
  }

  signOfflineRoster(payload: string, privateKeyPem: string): string {
    const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKeyPem);
    return signature.toString('hex');
  }

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

let lazyKmsInstance: KMSService | undefined;

export function getKMSService(config?: KMSConfig): KMSService {
  if (config) return new KMSService(config);
  if (!lazyKmsInstance) {
    lazyKmsInstance = new KMSService();
  }
  return lazyKmsInstance;
}
