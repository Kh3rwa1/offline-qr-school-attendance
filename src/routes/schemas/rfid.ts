import { z } from 'zod';

export const Uuid = z.string().uuid();

export const IssueCredentialBody = z.object({
  studentId: Uuid,
  credentialType: z.enum(['UHF_EPC', 'HF_UID']).default('UHF_EPC'),
  identifier: z.string().trim().min(4).max(128),
  facilityCode: z.coerce.number().int().optional(),
  cardType: z.string().trim().max(50).optional(),
}).strict();

export const UpdateCredentialStatusBody = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED', 'LOST']),
  reason: z.string().trim().max(255).optional(),
}).strict();

export const RegisterReaderBody = z.object({
  readerIdentifier: z.string().trim().min(3).max(100),
  readerType: z.enum(['ZEBRA_FX9600', 'GENERIC_GATEWAY', 'MOCK']).default('ZEBRA_FX9600'),
  locationDescription: z.string().trim().max(255).optional(),
  firmwareVersion: z.string().trim().max(50).optional(),
}).strict();

export const UpdateReaderStatusBody = z.object({
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']),
}).strict();
