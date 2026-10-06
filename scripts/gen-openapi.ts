// scripts/gen-openapi.ts
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

import {
  CreateStudentBody,
  UpdateStudentDetailsBody,
  UpdateStudentStatusBody,
  ListStudentsQuery,
} from '../src/routes/schemas/students';

import {
  CreateAttendanceSessionBody,
  UpdateAttendanceSessionStatusBody,
  ProcessAttendanceScanBody,
  ManualAttendanceStatusBody,
  BulkManualAttendanceStatusBody,
} from '../src/routes/schemas/attendance';

import {
  IssueCredentialBody,
  UpdateCredentialStatusBody,
  RegisterReaderBody,
  UpdateReaderStatusBody,
} from '../src/routes/schemas/rfid';

export function generateOpenApi(projectRoot: string = process.cwd()): void {
  const pkgPath = path.resolve(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const registry = new OpenAPIRegistry();

  // Security Schemes
  registry.registerComponent('securitySchemes', 'SessionAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'attendease_session',
    description: 'HttpOnly SameSite encrypted session cookie with CSRF double-submit token',
  });

  registry.registerComponent('securitySchemes', 'ReaderBearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Cryptographically hashed bearer token provisioned per Zebra FX9600 reader',
  });

  registry.registerComponent('securitySchemes', 'ReaderHmacAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'X-Signature-SHA256',
    description: 'HMAC-SHA256 over raw HTTP body using reader shared secret key',
  });

  // Common schemas
  const SchoolIdParam = z.string().uuid().describe('School UUID tenant identifier');
  const ErrorResponseSchema = z.object({
    error: z.string().describe('Machine-readable error code'),
    message: z.string().describe('Human-readable error description'),
    requestId: z.string().optional().describe('Unique request tracking ID'),
  });

  // Zebra Tag Read Schemas
  const ZebraTagReadSchema = z.object({
    epc: z.string().optional().describe('EPC hexadecimal string (96-bit or 128-bit)'),
    idHex: z.string().optional().describe('Alternative EPC hex representation'),
    tag_id: z.string().optional().describe('Legacy tag ID field'),
    antenna: z.union([z.number(), z.string()]).optional().describe('Antenna port ID (1-4)'),
    peakRssi: z.union([z.number(), z.string()]).optional().describe('Peak RSSI in dBm'),
    timestamp: z.union([z.string(), z.number()]).optional().describe('Reader ISO timestamp or epoch millis'),
    firstSeen: z.union([z.string(), z.number()]).optional().describe('First detected timestamp'),
    lastSeen: z.union([z.string(), z.number()]).optional().describe('Last detected timestamp'),
    reads: z.number().optional().describe('Accumulated reads in dwell duration'),
    tid: z.string().optional().describe('Factory TID hexadecimal string'),
    vendorEventId: z.string().optional().describe('Reader vendor event sequence ID'),
  });

  const ZebraWebhookPayloadSchema = z.object({
    data: z.array(ZebraTagReadSchema).max(250).describe('Array of tag reads (up to 250 items)'),
    reader_name: z.string().optional().describe('Reader hardware identifier'),
    timestamp: z.string().optional().describe('Transmission timestamp'),
  });

  const ZebraReadResultSchema = z.object({
    index: z.number().describe('Original index position in incoming batch'),
    decision: z.string().describe('Ingest pipeline decision (e.g. ACCEPTED, DUPLICATE_DEBOUNCED, UNREGISTERED_CARD)'),
    epcDigest: z.string().optional().describe('Salted SHA-256 EPC digest'),
    studentId: z.string().uuid().optional().describe('Matched student UUID if enrolled'),
    classSectionId: z.string().uuid().optional().describe('Associated class section UUID'),
    reviewFlag: z.string().optional().describe('Audit flag (e.g. LATE_BUFFERED, SERVER_TIME)'),
  });

  const ZebraWebhookResponseSchema = z.object({
    success: z.boolean().describe('Batch processing success status'),
    accepted: z.number().describe('Count of accepted present records'),
    duplicates: z.number().describe('Count of debounced duplicate reads'),
    rejected: z.number().describe('Count of rejected reads'),
    results: z.array(ZebraReadResultSchema).describe('Per-read evaluation outcome details'),
  });

  // 1. System Health
  registry.registerPath({
    method: 'get',
    path: '/api/v1/health',
    tags: ['System'],
    summary: 'Appliance health & readiness check',
    description: 'Returns status of database, redis cache, and background workers.',
    responses: {
      200: {
        description: 'System healthy',
        content: {
          'application/json': {
            schema: z.object({
              status: z.enum(['ok', 'degraded']),
              timestamp: z.string().datetime(),
              version: z.string(),
              database: z.string(),
              redis: z.string(),
            }),
          },
        },
      },
      503: {
        description: 'Service unhealthy or draining',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  // 2. Auth Endpoints
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['Authentication'],
    summary: 'Authenticate with phone number and password',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              phoneNumber: z.string().min(5).max(20),
              password: z.string().min(8),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Successfully authenticated, session cookie set',
        content: {
          'application/json': {
            schema: z.object({
              user: z.object({
                id: z.string().uuid(),
                name: z.string(),
                phoneNumber: z.string(),
                globalRole: z.string(),
              }),
            }),
          },
        },
      },
      401: {
        description: 'Invalid credentials or account locked',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  // 3. Zebra FX9600 Ingest Webhook
  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/rfid/zebra/reads',
    tags: ['RFID Gate Ingest'],
    summary: 'Zebra FX9600 IoT Connector webhook ingest',
    description: 'High-throughput batched tag read ingest endpoint. Supports Bearer token or HMAC-SHA256 signature.',
    security: [{ ReaderBearerAuth: [] }, { ReaderHmacAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam }),
      body: {
        content: {
          'application/json': { schema: ZebraWebhookPayloadSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Batch processed successfully with per-read decision list',
        content: {
          'application/json': { schema: ZebraWebhookResponseSchema },
        },
      },
      400: {
        description: 'Malformed payload or oversized batch (>250 reads)',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: 'Reader authentication failed (invalid bearer token or HMAC signature)',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      429: {
        description: 'Rate limit exceeded for reader',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  // 4. RFID Credential Management
  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/rfid/credentials',
    tags: ['RFID Credentials'],
    summary: 'Enroll / issue new UHF EPC badge credential to student',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam }),
      body: {
        content: { 'application/json': { schema: IssueCredentialBody } },
      },
    },
    responses: {
      201: {
        description: 'Credential enrolled successfully',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid(),
              studentId: z.string().uuid(),
              status: z.string(),
              epcLast4: z.string(),
            }),
          },
        },
      },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/schools/{schoolId}/rfid/credentials/{id}/status',
    tags: ['RFID Credentials'],
    summary: 'Update badge credential status (ACTIVE, SUSPENDED, REVOKED, LOST)',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, id: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: UpdateCredentialStatusBody } },
      },
    },
    responses: {
      200: { description: 'Status updated successfully' },
      404: { description: 'Credential not found' },
    },
  });

  // 5. RFID Reader Hardware Provisioning
  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/rfid/readers',
    tags: ['RFID Readers'],
    summary: 'Register a new Zebra FX9600 reader',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam }),
      body: {
        content: { 'application/json': { schema: RegisterReaderBody } },
      },
    },
    responses: {
      201: {
        description: 'Reader registered with provisioned bearer token and HMAC secret',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid(),
              readerIdentifier: z.string(),
              bearerToken: z.string().describe('Cleartext token displayed ONCE at creation'),
              hmacSecret: z.string().describe('Cleartext HMAC secret displayed ONCE at creation'),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/rfid/readers/{id}/rotate-secret',
    tags: ['RFID Readers'],
    summary: 'Rotate reader authentication secrets (bearer token and HMAC key)',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Rotated credentials generated',
        content: {
          'application/json': {
            schema: z.object({
              bearerToken: z.string().describe('New bearer token'),
              hmacSecret: z.string().describe('New HMAC secret'),
            }),
          },
        },
      },
    },
  });

  // 6. Student Roster API
  registry.registerPath({
    method: 'get',
    path: '/api/v1/schools/{schoolId}/students',
    tags: ['Students'],
    summary: 'List students in school tenant',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam }),
      query: ListStudentsQuery,
    },
    responses: {
      200: {
        description: 'Paginated list of students',
        content: {
          'application/json': {
            schema: z.object({
              students: z.array(
                z.object({
                  id: z.string().uuid(),
                  studentCode: z.string(),
                  name: z.string(),
                  nameBn: z.string().nullable(),
                  status: z.enum(['ACTIVE', 'INACTIVE', 'TRANSFERRED']),
                  rollNumber: z.number().nullable(),
                })
              ),
              total: z.number(),
              page: z.number(),
              limit: z.number(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/students',
    tags: ['Students'],
    summary: 'Create and enroll a new student record',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam }),
      body: {
        content: { 'application/json': { schema: CreateStudentBody } },
      },
    },
    responses: {
      201: {
        description: 'Student created successfully',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid(),
              studentCode: z.string(),
              name: z.string(),
              status: z.string(),
            }),
          },
        },
      },
      400: { description: 'Validation failed', content: { 'application/json': { schema: ErrorResponseSchema } } },
      403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/schools/{schoolId}/students/{id}',
    tags: ['Students'],
    summary: 'Update student demographics and details',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, id: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: UpdateStudentDetailsBody } },
      },
    },
    responses: {
      200: { description: 'Student updated successfully' },
      404: { description: 'Student not found' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/schools/{schoolId}/students/{id}/status',
    tags: ['Students'],
    summary: 'Update student enrollment status (ACTIVE, INACTIVE, TRANSFERRED)',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, id: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: UpdateStudentStatusBody } },
      },
    },
    responses: {
      200: { description: 'Student status updated successfully' },
      404: { description: 'Student not found' },
    },
  });

  // 7. Attendance Sessions & Teacher Review
  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/attendance/sessions',
    tags: ['Attendance Sessions'],
    summary: 'Create attendance session for class section and date',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam }),
      body: {
        content: { 'application/json': { schema: CreateAttendanceSessionBody } },
      },
    },
    responses: {
      201: {
        description: 'Session created or existing session returned',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid(),
              sessionDate: z.string(),
              status: z.string(),
              classSectionId: z.string().uuid(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/schools/{schoolId}/attendance/sessions/{sessionId}/status',
    tags: ['Attendance Sessions'],
    summary: 'Finalize attendance session and trigger absentee alerts',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, sessionId: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: UpdateAttendanceSessionStatusBody } },
      },
    },
    responses: {
      200: {
        description: 'Session finalized, unmarked students marked absent, parent SMS queued',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().uuid(),
              status: z.string(),
              presentCount: z.number(),
              absentCount: z.number(),
              messagesQueued: z.number(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/attendance/sessions/{sessionId}/manual',
    tags: ['Attendance Sessions'],
    summary: 'Record manual teacher attendance override for a student',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, sessionId: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: ManualAttendanceStatusBody } },
      },
    },
    responses: {
      200: { description: 'Manual override recorded' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/schools/{schoolId}/attendance/sessions/{sessionId}/manual/bulk',
    tags: ['Attendance Sessions'],
    summary: 'Bulk record manual teacher attendance overrides',
    security: [{ SessionAuth: [] }],
    request: {
      params: z.object({ schoolId: SchoolIdParam, sessionId: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: BulkManualAttendanceStatusBody } },
      },
    },
    responses: {
      200: { description: 'Bulk overrides recorded successfully' },
    },
  });

  // Generate OpenAPI 3.1 Document
  const generator = new OpenApiGeneratorV31(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'AttendEase OS API',
      version: pkg.version ?? '2.0.0',
      description:
        'Official REST & Webhook API specification for AttendEase OS UHF RFID & Offline QR attendance appliance.',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Local appliance base path',
      },
    ],
  });

  const outPath = path.resolve(projectRoot, 'docs/reference/openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');
}

if (process.argv[1]?.endsWith('gen-openapi.ts')) {
  generateOpenApi();
  console.log('Generated docs/reference/openapi.json');
}
