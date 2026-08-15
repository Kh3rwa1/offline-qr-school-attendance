import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  generateXlsxTemplate,
  parseAndValidateFile,
  executeTransactionalImport,
  ImportMode,
} from '../services/importService';
import { createAuditLog } from '../services/auditLogService';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

export const importRouter = Router();

// GET /api/v1/schools/:schoolId/students/import-template
importRouter.get(
  '/:schoolId/students/import-template',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const buffer = await generateXlsxTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Import_Template.xlsx"');
    return res.send(buffer);
  }
);

// POST /api/v1/schools/:schoolId/students/import-file (Supports XLSX, CSV, JSON)
importRouter.post(
  ['/:schoolId/students/import-file', '/:schoolId/students/import-xlsx', '/:schoolId/students/import-csv', '/:schoolId/students/import-json'],
  rateLimitPolicies.import,
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    let fileBuffer: Buffer | null = null;
    let fileName = 'import-upload.json';

    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname;
    } else if (req.body && req.body.data) {
      fileBuffer = Buffer.from(typeof req.body.data === 'string' ? req.body.data : JSON.stringify(req.body.data));
      fileName = req.body.fileName || 'import-data.json';
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'NO_FILE_UPLOADED', message: 'A file or data payload is required' });
    }

    const mode = (req.body.mode || 'CREATE_ONLY') as ImportMode;

    try {
      const validationResult = await parseAndValidateFile({
        schoolId,
        fileBuffer,
        fileName,
        createdBy: req.user!.id,
        mode,
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'STAGED_IMPORT',
        resourceType: 'IMPORT_JOB',
        resourceId: validationResult.importJobId,
        metadata: {
          fileName,
          mode,
          totalRows: validationResult.totalRows,
          validRows: validationResult.validRowsCount,
          invalidRows: validationResult.invalidRowsCount,
        },
      });

      return res.json(validationResult);
    } catch (err: any) {
      return res.status(400).json({ error: 'IMPORT_VALIDATION_FAILED', message: err.message });
    }
  }
);

// POST /api/v1/schools/:schoolId/students/import-confirm
importRouter.post(
  '/:schoolId/students/import-confirm',
  rateLimitPolicies.import,
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { importJobId, confirmToken } = req.body;

    if (!importJobId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'importJobId is required',
      });
    }

    try {
      const result = await executeTransactionalImport({
        schoolId,
        importJobId,
        createdBy: req.user!.id,
        confirmToken,
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'EXECUTE_IMPORT',
        resourceType: 'IMPORT_JOB',
        resourceId: importJobId,
        metadata: { importedCount: result.importedCount },
      });

      return res.json({ status: 'SUCCESS', ...result });
    } catch (err: any) {
      return res.status(400).json({
        error: 'IMPORT_EXECUTION_FAILED',
        message: err.message,
      });
    }
  }
);

export default importRouter;
