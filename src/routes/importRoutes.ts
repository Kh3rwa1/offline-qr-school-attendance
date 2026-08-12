import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  generateXlsxTemplate,
  parseAndValidateXlsx,
  executeTransactionalImport,
} from '../services/importService';
import { createAuditLog } from '../services/auditLogService';

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

// POST /api/v1/schools/:schoolId/students/import-xlsx
importRouter.post(
  '/:schoolId/students/import-xlsx',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    if (!req.file) {
      return res.status(400).json({ error: 'NO_FILE_UPLOADED', message: 'An XLSX file is required' });
    }

    try {
      const validationResult = await parseAndValidateXlsx({
        schoolId,
        fileBuffer: req.file.buffer,
        fileName: req.file.originalname,
        createdBy: req.user!.id,
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'STAGED_XLSX_IMPORT',
        resourceType: 'IMPORT_JOB',
        resourceId: validationResult.importJobId,
        metadata: {
          fileName: req.file.originalname,
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
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { importJobId, validRows } = req.body;

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
        validRows,
        createdBy: req.user!.id,
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'EXECUTE_XLSX_IMPORT',
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
