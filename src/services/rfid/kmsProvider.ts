import crypto from 'crypto';

export interface KmsKeyMetadata {
  keyId: string;
  algorithm: string;
  version: number;
}

export interface EncryptedDataKeyResult {
  encryptedDataKeyHex: string;
  keyId: string;
  algorithm: string;
  version: number;
}

export interface KmsProvider {
  encryptDataKey(keyId: string, plainKey: Buffer): Promise<EncryptedDataKeyResult>;
  decryptDataKey(keyId: string, encryptedDataKeyHex: string, version?: number): Promise<Buffer>;
  getKeyMetadata(keyId: string): Promise<KmsKeyMetadata>;
}

export class LocalKmsProvider implements KmsProvider {
  private masterKeys: Map<string, Buffer> = new Map();
  private keyVersions: Map<string, number> = new Map();

  constructor(masterSecrets?: Record<string, string>, defaultVersion: number = 1) {
    if (masterSecrets) {
      for (const [keyId, secret] of Object.entries(masterSecrets)) {
        this.setKey(keyId, secret, defaultVersion);
      }
    }
  }

  setKey(keyId: string, secret: string, version: number = 1): void {
    if (!secret || secret.length < 32) {
      throw new Error('KMS_FATAL: KMS master key secret must be at least 32 bytes (256 bits)');
    }
    // Derive a distinct 32-byte key for each keyId using HKDF/HMAC
    const derivedKey = crypto.hkdfSync('sha256', secret, 'kms-salt', `kms-provider-${keyId}`, 32);
    this.masterKeys.set(keyId, Buffer.from(derivedKey));
    this.keyVersions.set(keyId, version);
  }

  async getKeyMetadata(keyId: string): Promise<KmsKeyMetadata> {
    const version = this.keyVersions.get(keyId) || 1;
    return { keyId, algorithm: 'AES-256-GCM', version };
  }

  async encryptDataKey(keyId: string, plainKey: Buffer): Promise<EncryptedDataKeyResult> {
    const kek = this.masterKeys.get(keyId);
    if (!kek) throw new Error(`KMS_KEY_NOT_FOUND: Key ID '${keyId}' not found in KMS provider`);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    const encrypted = Buffer.concat([cipher.update(plainKey), cipher.final()]);
    const tag = cipher.getAuthTag();

    const version = this.keyVersions.get(keyId) || 1;
    // Format: iv:tag:encrypted
    const encryptedDataKeyHex = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;

    return {
      encryptedDataKeyHex,
      keyId,
      algorithm: 'AES-256-GCM',
      version,
    };
  }

  async decryptDataKey(keyId: string, encryptedDataKeyHex: string, version?: number): Promise<Buffer> {
    const kek = this.masterKeys.get(keyId);
    if (!kek) throw new Error(`KMS_KEY_NOT_FOUND: Key ID '${keyId}' not found in KMS provider`);

    if (!encryptedDataKeyHex || typeof encryptedDataKeyHex !== 'string') {
      throw new Error('KMS_DECRYPT_FAILED: Ciphertext payload missing or malformed');
    }

    const parts = encryptedDataKeyHex.split(':');
    if (parts.length !== 3) {
      throw new Error('KMS_DECRYPT_FAILED: Ciphertext envelope is malformed or truncated');
    }

    const [ivHex, tagHex, cipherHex] = parts;
    if (!ivHex || !tagHex || !cipherHex) {
      throw new Error('KMS_DECRYPT_FAILED: Ciphertext components are missing');
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const cipherText = Buffer.from(cipherHex, 'hex');

      if (iv.length !== 12 || tag.length !== 16) {
        throw new Error('KMS_DECRYPT_FAILED: Invalid IV or Auth Tag length');
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(cipherText), decipher.final()]);
    } catch (err: any) {
      throw new Error(`KMS_DECRYPT_FAILED: Decryption authentication failed or payload tampered: ${err.message}`);
    }
  }
}

export class CloudKmsProviderAdapter implements KmsProvider {
  constructor(private providerName: string = 'AWS_KMS') {}

  async getKeyMetadata(keyId: string): Promise<KmsKeyMetadata> {
    return { keyId, algorithm: 'AES-256-GCM', version: 1 };
  }

  async encryptDataKey(keyId: string, plainKey: Buffer): Promise<EncryptedDataKeyResult> {
    throw new Error(`CLOUD_KMS_NOT_CONFIGURED: Production ${this.providerName} integration boundary ready. AWS_KMS_KEY_ARN or GCP_KMS_RESOURCE_ID required.`);
  }

  async decryptDataKey(keyId: string, encryptedDataKeyHex: string): Promise<Buffer> {
    throw new Error(`CLOUD_KMS_NOT_CONFIGURED: Production ${this.providerName} integration boundary ready. AWS_KMS_KEY_ARN or GCP_KMS_RESOURCE_ID required.`);
  }
}
