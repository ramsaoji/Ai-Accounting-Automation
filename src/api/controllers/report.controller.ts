import fs from 'fs';
import path from 'path';
import { getReport } from '../../db/db.client.js';
import { orchestratorService } from '../../services/orchestrator.service.js';
import { logger } from '../../logger/logger.js';
import { config } from '../../config/config.js';
import { verifyToken } from './security.controller.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../errors.js';

/**
 * GET /api/data/sales
 * Serves real-time sales summary data (reconciled cashflow metrics and benchmarks).
 */
export async function getSalesReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isDbActive = !!config.DATABASE_URL;

  if (isDbActive) {
    try {
      const dbData = await getReport('sales');
      if (dbData) {
        reply.code(200).send(dbData);
        return;
      }
      reply.code(404).send(Errors.notFound('Sales summary dataset'));
    } catch (dbErr: unknown) {
      const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error({ err: message }, 'Failed to fetch sales report from database');
      reply.code(503).send(Errors.databaseError('Sales report'));
    }
  } else {
    const filePath = path.resolve(process.cwd(), 'data', 'output', config.BUSINESS_NAME, 'summary.json');
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      reply.code(200).send(JSON.parse(data));
    } catch (err) {
      logger.error({ err, filePath }, 'Failed to read sales summary JSON file from disk');
      reply.code(404).send(Errors.notFound('Sales summary dataset on disk'));
    }
  }
}

/**
 * GET /api/data/debitors
 * Serves outstanding debtor lists, active udhari accounts, and aging statistics.
 */
export async function getDebitorsReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isDbActive = !!config.DATABASE_URL;

  if (isDbActive) {
    try {
      const dbData = await getReport('debitors');
      if (dbData) {
        reply.code(200).send(dbData);
        return;
      }
      reply.code(404).send(Errors.notFound('Debitors summary dataset'));
    } catch (dbErr: unknown) {
      const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error({ err: message }, 'Failed to fetch debitors report from database');
      reply.code(503).send(Errors.databaseError('Debitors report'));
    }
  } else {
    const filePath = path.resolve(process.cwd(), 'data', 'output', 'DEBITORS LIST', 'summary.json');
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      reply.code(200).send(JSON.parse(data));
    } catch (err) {
      logger.error({ err, filePath }, 'Failed to read debitors summary JSON file from disk');
      reply.code(404).send(Errors.notFound('Debitors summary dataset on disk'));
    }
  }
}

/**
 * POST /api/trigger-pipeline
 * Securely triggers an immediate, asynchronous Excel sheets ingestion run.
 */
export async function triggerPipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.info('Manual pipeline execution triggered via HTTP POST request');

  // Concurrency guard — return early if pipeline is already running
  if (orchestratorService.running) {
    logger.warn('Pipeline trigger rejected: pipeline is already running.');
    reply.code(409).send(Errors.conflict('Pipeline is already running. Please wait for it to complete.'));
    return;
  }

  try {
    const { hasNew, newFilesCount } = await orchestratorService.checkNewFiles();

    if (!hasNew) {
      logger.info('All spreadsheets are already up-to-date. Skipping background execution.');
      reply.code(200).send({ status: 'up-to-date', message: 'All spreadsheets are already up-to-date' });
      return;
    }

    logger.info({ newFilesCount }, 'New files detected. Triggering background pipeline execution');

    orchestratorService.runPipeline().then(() => {
      logger.info('Background manual pipeline execution completed successfully');
    }).catch((err) => {
      logger.error({ err }, 'Background manual HTTP pipeline run failed');
    });

    reply.code(202).send({ status: 'processing', message: `Sync started. Ingesting ${newFilesCount} spreadsheet(s)...` });
  } catch (err) {
    logger.error({ err }, 'Failed during pre-sync check');
    reply.code(500).send(Errors.internalError('Sync request failed due to an internal server error'));
  }
}

/**
 * POST /api/ledger/upload
 * Ingests an Excel file dynamically through the full pipeline.
 * Validates file extension and session token before processing.
 */
export async function handleFileUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.info('File upload request received');

  try {
    const creds = await (await import('./security.controller.js')).getSecurityCredentials();
    const targetUploadPassword = creds.uploadPassword;

    let fileName: string | undefined;
    let buffer: Buffer | undefined;
    let sessionToken: string | undefined;

    if (request.isMultipart()) {
      const parts = await request.file();
      if (!parts) {
      reply.code(400).send(Errors.badRequest('No file uploaded'));
        return;
      }
      fileName = parts.filename;
      buffer = await parts.toBuffer();
      sessionToken = parts.fields && parts.fields.sessionToken
        ? (parts.fields.sessionToken as { value: string }).value
        : undefined;
    } else {
      const body = request.body as { fileName?: string; fileData?: string; sessionToken?: string } | undefined;
      sessionToken = body?.sessionToken;
      fileName = body?.fileName;
      if (body?.fileData) {
        buffer = Buffer.from(body.fileData, 'base64');
      }
    }

    if (fileName && !fileName.toLowerCase().endsWith('.xlsx')) {
      logger.warn({ fileName }, 'Rejected upload: file is not a valid .xlsx spreadsheet');
      reply.code(400).send(Errors.badRequest('Invalid file type: only Excel (.xlsx) spreadsheets are accepted'));
      return;
    }

    if (targetUploadPassword) {
      const payload = sessionToken ? verifyToken(sessionToken) : null;
      if (!payload || !payload.uploadAuthorized) {
        logger.warn({ fileName: fileName || 'unknown' }, 'Unauthorized upload attempt: invalid or expired session token');
        reply.code(401).send(Errors.unauthorized('Invalid or expired upload session'));
        return;
      }
    }

    if (!fileName || !buffer) {
      reply.code(400).send(Errors.badRequest('fileName and file data are required'));
      return;
    }

    const summary = await orchestratorService.processFileBuffer(buffer, fileName);
    reply.code(200).send(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Error handling file upload');
    reply.code(500).send(Errors.internalError('Failed to process spreadsheet file'));
  }
}
