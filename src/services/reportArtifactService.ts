import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../db';

export type ReportArtifactFormat = 'xlsx' | 'csv' | 'html';
export type ReportArtifactStorageBackend = 'database' | 'filesystem';

export const REPORT_FORMAT_CONTRACT: Record<
  ReportArtifactFormat,
  { extension: string; contentType: string }
> = {
  xlsx: {
    extension: '.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  csv: {
    extension: '.csv',
    contentType: 'text/csv; charset=utf-8',
  },
  html: {
    extension: '.html',
    contentType: 'text/html; charset=utf-8',
  },
};

export interface StoredReportArtifact {
  id: string;
  schoolId: string;
  reportId: string;
  format: ReportArtifactFormat;
  contentType: string;
  filename: string;
  byteSize: number;
  sha256: string;
  storageBackend: ReportArtifactStorageBackend;
  createdAt: Date;
  content: Buffer;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getReportArtifactMaxBytes(): number {
  return parsePositiveInt(process.env.REPORT_ARTIFACT_MAX_BYTES, 50 * 1024 * 1024);
}

function getStorageBackend(): ReportArtifactStorageBackend {
  const configured = (process.env.REPORT_ARTIFACT_STORAGE || 'database').toLowerCase();
  if (configured !== 'database' && configured !== 'filesystem') {
    throw new Error('REPORT_ARTIFACT_STORAGE_INVALID');
  }
  return configured;
}

function getFilesystemRoot(): string {
  return path.resolve(process.env.REPORT_ARTIFACT_DIR || './report-artifacts');
}

function assertUuid(value: string, code: string) {
  if (!UUID_RE.test(value)) throw new Error(code);
}

function looksLikeXlsx(content: Buffer): boolean {
  return content.length >= 4 && content[0] === 0x50 && content[1] === 0x4b;
}

function looksLikeHtml(content: Buffer): boolean {
  const prefix = content.subarray(0, Math.min(content.length, 512)).toString('utf8').trimStart().toLowerCase();
  return prefix.startsWith('<!doctype html') || prefix.startsWith('<html');
}

function looksLikeCsv(content: Buffer): boolean {
  if (content.length === 0 || looksLikeXlsx(content) || looksLikeHtml(content)) return false;
  const prefix = content.subarray(0, Math.min(content.length, 4096)).toString('utf8');
  return prefix.includes(',') && (prefix.includes('\n') || prefix.includes('\r'));
}

export function assertReportArtifactContract(params: {
  format: ReportArtifactFormat;
  contentType: string;
  filename: string;
  content: Buffer;
}) {
  const contract = REPORT_FORMAT_CONTRACT[params.format];
  if (!contract) throw new Error('REPORT_FORMAT_UNSUPPORTED');
  if (params.contentType !== contract.contentType) throw new Error('REPORT_MIME_MISMATCH');
  if (!params.filename.toLowerCase().endsWith(contract.extension)) {
    throw new Error('REPORT_EXTENSION_MISMATCH');
  }
  if (params.filename.includes('/') || params.filename.includes('\\') || params.filename.includes('..')) {
    throw new Error('REPORT_FILENAME_UNSAFE');
  }
  if (!Buffer.isBuffer(params.content) || params.content.length === 0) {
    throw new Error('REPORT_ARTIFACT_EMPTY');
  }

  const validBytes =
    params.format === 'xlsx'
      ? looksLikeXlsx(params.content)
      : params.format === 'html'
        ? looksLikeHtml(params.content)
        : looksLikeCsv(params.content);
  if (!validBytes) throw new Error('REPORT_BYTES_FORMAT_MISMATCH');
}

function toArtifact(row: any, content: Buffer): StoredReportArtifact {
  return {
    id: String(row.id),
    schoolId: String(row.school_id),
    reportId: String(row.report_id),
    format: row.format as ReportArtifactFormat,
    contentType: String(row.content_type),
    filename: String(row.filename),
    byteSize: Number(row.byte_size),
    sha256: String(row.sha256),
    storageBackend: row.storage_backend as ReportArtifactStorageBackend,
    createdAt: new Date(row.created_at),
    content,
  };
}

async function writeFilesystemArtifact(params: {
  schoolId: string;
  reportId: string;
  format: ReportArtifactFormat;
  content: Buffer;
}): Promise<{ absolutePath: string; storageKey: string }> {
  assertUuid(params.schoolId, 'REPORT_SCHOOL_ID_INVALID');
  assertUuid(params.reportId, 'REPORT_ID_INVALID');

  const root = getFilesystemRoot();
  const directory = path.resolve(root, params.schoolId, params.reportId);
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error('REPORT_STORAGE_PATH_UNSAFE');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);

  const storageKey = `${params.schoolId}/${params.reportId}/artifact.${params.format}`;
  const absolutePath = path.resolve(root, storageKey);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error('REPORT_STORAGE_PATH_UNSAFE');

  const temporaryPath = `${absolutePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, params.content, { mode: 0o600, flag: 'wx' });
  await fs.chmod(temporaryPath, 0o600);
  await fs.rename(temporaryPath, absolutePath);
  await fs.chmod(absolutePath, 0o600);
  return { absolutePath, storageKey };
}

export async function persistReportArtifact(params: {
  schoolId: string;
  reportId: string;
  format: ReportArtifactFormat;
  contentType: string;
  filename: string;
  content: Buffer;
}): Promise<Omit<StoredReportArtifact, 'content'>> {
  assertUuid(params.schoolId, 'REPORT_SCHOOL_ID_INVALID');
  assertUuid(params.reportId, 'REPORT_ID_INVALID');
  assertReportArtifactContract(params);

  const maxBytes = getReportArtifactMaxBytes();
  if (params.content.length > maxBytes) throw new Error('REPORT_ARTIFACT_SIZE_LIMIT_EXCEEDED');

  const sha256 = crypto.createHash('sha256').update(params.content).digest('hex');
  const storageBackend = getStorageBackend();
  let storageKey: string | null = null;
  let absolutePath: string | null = null;

  try {
    if (storageBackend === 'filesystem') {
      const stored = await writeFilesystemArtifact(params);
      storageKey = stored.storageKey;
      absolutePath = stored.absolutePath;
    }

    const inserted = await db.execute(sql`
      INSERT INTO report_artifacts (
        school_id, report_id, format, content_type, filename, byte_size,
        sha256, storage_backend, storage_key, content
      ) VALUES (
        ${params.schoolId}::uuid,
        ${params.reportId}::uuid,
        ${params.format},
        ${params.contentType},
        ${params.filename},
        ${params.content.length},
        ${sha256},
        ${storageBackend},
        ${storageKey},
        ${storageBackend === 'database' ? params.content : null}
      )
      RETURNING id, school_id, report_id, format, content_type, filename,
        byte_size, sha256, storage_backend, created_at
    `);

    const row = (inserted.rows as any[])[0];
    if (!row) throw new Error('REPORT_ARTIFACT_PERSIST_FAILED');
    const artifact = toArtifact(row, params.content);
    const { content: _content, ...metadata } = artifact;
    return metadata;
  } catch (error) {
    if (absolutePath) await fs.unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

async function readFilesystemContent(storageKey: string): Promise<Buffer> {
  const root = getFilesystemRoot();
  const absolutePath = path.resolve(root, storageKey);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error('REPORT_STORAGE_PATH_UNSAFE');
  return fs.readFile(absolutePath);
}

export async function loadReportArtifact(
  schoolId: string,
  reportId: string
): Promise<StoredReportArtifact | null> {
  assertUuid(schoolId, 'REPORT_SCHOOL_ID_INVALID');
  assertUuid(reportId, 'REPORT_ID_INVALID');

  const result = await db.execute(sql`
    SELECT id, school_id, report_id, format, content_type, filename, byte_size,
      sha256, storage_backend, storage_key, content, created_at
    FROM report_artifacts
    WHERE school_id = ${schoolId}::uuid AND report_id = ${reportId}::uuid
    LIMIT 1
  `);
  const row = (result.rows as any[])[0];
  if (!row) return null;

  const content = row.storage_backend === 'database'
    ? Buffer.from(row.content)
    : await readFilesystemContent(String(row.storage_key));
  const artifact = toArtifact(row, content);

  assertReportArtifactContract({
    format: artifact.format,
    contentType: artifact.contentType,
    filename: artifact.filename,
    content: artifact.content,
  });
  if (artifact.content.length !== artifact.byteSize) throw new Error('REPORT_ARTIFACT_SIZE_MISMATCH');
  const actualHash = crypto.createHash('sha256').update(artifact.content).digest('hex');
  if (actualHash !== artifact.sha256) throw new Error('REPORT_ARTIFACT_HASH_MISMATCH');

  return artifact;
}
