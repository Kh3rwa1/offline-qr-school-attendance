import { z } from 'zod';

export const Uuid = z.string().uuid();

export const CreateStudentBody = z.object({
  studentCode: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  nameBn: z.string().trim().max(255).optional(),
  banglarShikshaId: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  gender: z.enum(['M', 'F', 'O']).optional(),
  photoUrl: z.string().url().max(1000).optional(),
  classSectionId: Uuid,
  academicYearId: Uuid,
  rollNumber: z.coerce.number().int().min(1).max(99999),
  guardian: z.object({
    name: z.string().trim().min(1).max(255),
    phoneNumber: z.string().trim().min(5).max(20),
    relationship: z.string().trim().max(50).optional(),
    isPrimary: z.boolean().optional(),
  }).strict().optional(),
}).strict();

export const UpdateStudentDetailsBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  nameBn: z.string().trim().max(255).optional(),
  banglarShikshaId: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  gender: z.enum(['M', 'F', 'O']).optional(),
  photoUrl: z.string().url().max(1000).optional(),
  studentCode: z.string().trim().min(1).max(50).optional(),
}).strict();

export const UpdateStudentStatusBody = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRANSFERRED']),
}).strict();

export const ListStudentsQuery = z.object({
  schoolId: Uuid.optional(),
  classSectionId: Uuid.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRANSFERRED']).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
}).strict();
