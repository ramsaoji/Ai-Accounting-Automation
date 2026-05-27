import http from 'http';
import fs from 'fs';
import path from 'path';
import { getReport } from '../../db/db.client.js';
import { orchestratorService } from '../../services/orchestrator.service.js';
import { logger } from '../../logger/logger.js';
import { corsHeaders } from '../cors.js';
import { config } from '../../config/config.js';

/**
 * GET /api/data/sales
 * Serves real-time sales summary data (reconciled cashflow metrics and benchmarks).
 */
export function getSalesReport(req: http.IncomingMessage, res: http.ServerResponse): void {
  const isDbActive = !!config.DATABASE_URL;

  if (isDbActive) {
    getReport('sales').then((dbData) => {
      if (dbData) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(dbData));
        return;
      }
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({ error: 'Sales summary dataset not found in database' }));
    }).catch((dbErr) => {
      logger.error({ err: dbErr.message }, 'Failed to fetch sales report from database');
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({ error: 'Failed to fetch sales report from database' }));
    });
  } else {
    const filePath = path.resolve(process.cwd(), 'data', 'output', 'Hotel Gaurav Daily Sales Register', 'summary.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        logger.error({ err, filePath }, 'Failed to read sales summary JSON file from disk');
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Sales summary dataset not found on disk' }));
        return;
      }
      res.writeHead(200, corsHeaders);
      res.end(data);
    });
  }
}

/**
 * GET /api/data/debitors
 * Serves outstanding debtor lists, active udhari accounts, and aging statistics.
 */
export function getDebitorsReport(req: http.IncomingMessage, res: http.ServerResponse): void {
  const isDbActive = !!config.DATABASE_URL;

  if (isDbActive) {
    getReport('debitors').then((dbData) => {
      if (dbData) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(dbData));
        return;
      }
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({ error: 'Debitors summary dataset not found in database' }));
    }).catch((dbErr) => {
      logger.error({ err: dbErr.message }, 'Failed to fetch debitors report from database');
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({ error: 'Failed to fetch debitors report from database' }));
    });
  } else {
    const filePath = path.resolve(process.cwd(), 'data', 'output', 'DEBITORS LIST', 'summary.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        logger.error({ err, filePath }, 'Failed to read debitors summary JSON file from disk');
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Debitors summary dataset not found on disk' }));
        return;
      }
      res.writeHead(200, corsHeaders);
      res.end(data);
    });
  }
}

/**
 * POST /api/trigger-pipeline, POST /trigger-pipeline
 * Securely triggers an immediate, asynchronous Excel sheets ingestion run.
 */
export async function triggerPipeline(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  logger.info('Manual pipeline execution triggered via HTTP POST request');
  
  try {
    const { hasNew, newFilesCount } = await orchestratorService.checkNewFiles();
    
    if (!hasNew) {
      logger.info('All spreadsheets are already up-to-date. Skipping background execution.');
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ status: 'up-to-date', message: 'All spreadsheets are already up-to-date' }));
      return;
    }

    logger.info({ newFilesCount }, 'New files detected. Triggering background pipeline execution');
    
    // Fire-and-forget in background to return early
    orchestratorService.runPipeline().then(() => {
      logger.info('Background manual pipeline execution completed successfully');
    }).catch((err) => {
      logger.error({ err }, 'Background manual HTTP pipeline run failed');
    });

    res.writeHead(202, corsHeaders);
    res.end(JSON.stringify({ status: 'processing', message: `Sync started. Ingesting ${newFilesCount} spreadsheet(s)...` }));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Failed during pre-sync check');
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: `Sync request failed: ${errMsg}` }));
  }
}

/**
 * POST /api/upload, POST /upload
 * Ingests an Excel file encoded as base64 in JSON body, parses and audits it dynamically.
 */
export function handleFileUpload(req: http.IncomingMessage, res: http.ServerResponse): void {
  logger.info('File upload request received');
  
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { fileName, fileData } = JSON.parse(body);
      
      if (!fileName || !fileData) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'fileName and fileData (base64) are required fields' }));
        return;
      }

      // Decode base64 to buffer
      const buffer = Buffer.from(fileData, 'base64');
      
      // Process through orchestrator pipeline
      const summary = await orchestratorService.processFileBuffer(buffer, fileName);

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(summary));
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error handling file upload');
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Failed to process spreadsheet file', details: err.message }));
    }
  });
}
