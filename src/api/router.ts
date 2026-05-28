import http from 'http';
import { handleCorsPreflight, corsHeaders } from './cors.js';
import { getHealth } from './controllers/health.controller.js';
import { getSalesReport, getDebitorsReport, triggerPipeline, handleFileUpload } from './controllers/report.controller.js';
import { handleAdvisorChat } from './controllers/chat.controller.js';
import { verifyAppPassword, changePasswords } from './controllers/security.controller.js';

/**
 * Directs incoming HTTP requests to their matching controller logic.
 */
export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // Intercept CORS preflight OPTIONS checks
  if (handleCorsPreflight(req, res)) {
    return;
  }

  const rawUrl = req.url || '';
  // Strip query parameters
  let parsedUrl = rawUrl.split('?')[0];
  // Normalize trailing slash (unless the path is just "/")
  if (parsedUrl.endsWith('/') && parsedUrl.length > 1) {
    parsedUrl = parsedUrl.slice(0, -1);
  }

  const method = req.method || 'GET';

  // GET/HEAD: Health / Default Landing
  if ((parsedUrl === '/health' || parsedUrl === '/') && (method === 'GET' || method === 'HEAD')) {
    getHealth(req, res);
    return;
  }

  // GET: Real-time Sales Summary
  if (parsedUrl === '/api/data/sales' && method === 'GET') {
    getSalesReport(req, res);
    return;
  }

  // GET: Real-time Outstanding Debitors
  if (parsedUrl === '/api/data/debitors' && method === 'GET') {
    getDebitorsReport(req, res);
    return;
  }

  // POST: Trigger Manual Accounting Ingestion Run
  if ((parsedUrl === '/trigger-pipeline' || parsedUrl === '/api/trigger-pipeline') && method === 'POST') {
    triggerPipeline(req, res);
    return;
  }

  // POST: Interactive AI Advisory Chat Sessions
  if ((parsedUrl === '/chat' || parsedUrl === '/api/chat') && method === 'POST') {
    handleAdvisorChat(req, res);
    return;
  }

  // POST: Upload and process Excel spreadsheets
  if ((parsedUrl === '/upload' || parsedUrl === '/api/upload') && method === 'POST') {
    handleFileUpload(req, res);
    return;
  }

  // POST: Verify App Lock Screen Credentials
  if (parsedUrl === '/api/security/verify-app' && method === 'POST') {
    verifyAppPassword(req, res);
    return;
  }

  // POST: Change App Lock or Ingestion Passwords
  if (parsedUrl === '/api/security/change' && method === 'POST') {
    changePasswords(req, res);
    return;
  }

  // Fallback: 404 Path Not Found
  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({ error: 'Route Not Found' }));
}
