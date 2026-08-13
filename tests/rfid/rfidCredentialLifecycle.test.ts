import { describe, it, expect } from 'vitest';
import { credentialService } from '../../src/services/rfid/credentialService';

describe('RFID Credential Lifecycle Unit Tests', () => {
  it('credentialService exposes lifecycle methods', () => {
    expect(typeof credentialService.enrollCredential).toBe('function');
    expect(typeof credentialService.activateCredential).toBe('function');
    expect(typeof credentialService.suspendCredential).toBe('function');
    expect(typeof credentialService.reactivateCredential).toBe('function');
    expect(typeof credentialService.revokeCredential).toBe('function');
    expect(typeof credentialService.replaceCredential).toBe('function');
    expect(typeof credentialService.expireCredentials).toBe('function');
    expect(typeof credentialService.lookupActiveCredential).toBe('function');
    expect(typeof credentialService.getCredentialHistory).toBe('function');
    expect(typeof credentialService.getCredentialById).toBe('function');
    expect(typeof credentialService.bulkEnroll).toBe('function');
  });
});
