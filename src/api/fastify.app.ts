import fastify from 'fastify';
import FastifyCors from '@fastify/cors';
import FastifyMultipart from '@fastify/multipart';
import FastifyCookie from '@fastify/cookie';
import { config } from '../config/config.js';
import { getHealth } from './controllers/health.controller.js';
import {
  verifyAppPassword,
  changePasswords,
  verifyUploadPasscode,
  verifyAppSchema,
  verifyUploadSchema,
  changePasswordsSchema,
  checkSessionStatus,
  logoutUser
} from './controllers/security.controller.js';
import { getSalesReport, getDebitorsReport, triggerPipeline, handleFileUpload } from './controllers/report.controller.js';
import { handleAdvisorChat, chatSchema } from './controllers/chat.controller.js';
import { checkFastifyAuth } from './fastify.auth.js';
import { validateBody } from './middleware/validate.js';

export function createFastifyApp() {
  // Initialize Fastify with a 10MB request payload limit
  const app = fastify({
    logger: false,
    bodyLimit: 10485760, // 10MB limit to support large base64 spreadsheet uploads
  });

  // Register Cookie support
  app.register(FastifyCookie);

  // Register Multipart support
  app.register(FastifyMultipart, {
    limits: {
      fileSize: 10485760, // 10MB limit
    },
  });

  // Global hook to disable caching on all API responses
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return payload;
  });

  // Dynamic CORS registration — origins come from the Zod-validated config schema
  app.register(FastifyCors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      const isLocalhost =
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');
      const isAllowedOrigin = config.ALLOWED_ORIGINS.includes(origin);

      if (isLocalhost || isAllowedOrigin) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Public health-check routes
  app.get('/health', getHealth);
  app.get('/', getHealth);
  app.post('/api/security/verify-app', { preHandler: validateBody(verifyAppSchema) }, verifyAppPassword);
  app.post('/api/v1/security/verify-app', { preHandler: validateBody(verifyAppSchema) }, verifyAppPassword); // v1 alias

  // Cookie-session helper routes
  app.get('/api/security/status', checkSessionStatus);
  app.get('/api/v1/security/status', checkSessionStatus);
  app.post('/api/security/logout', logoutUser);
  app.post('/api/v1/security/logout', logoutUser);

  // Authenticated workspace routes (legacy /api prefix — kept for backward compatibility)
  app.register(async (authRoutes) => {
    authRoutes.addHook('preHandler', checkFastifyAuth);

    authRoutes.get('/api/data/sales', getSalesReport);
    authRoutes.get('/api/data/debitors', getDebitorsReport);
    authRoutes.post('/api/trigger-pipeline', triggerPipeline);
    authRoutes.post('/api/chat', { preHandler: validateBody(chatSchema) }, handleAdvisorChat);
    authRoutes.post('/api/security/verify-upload', { preHandler: validateBody(verifyUploadSchema) }, verifyUploadPasscode);
    authRoutes.post('/api/ledger/upload', handleFileUpload);
    authRoutes.post('/api/security/change', { preHandler: validateBody(changePasswordsSchema) }, changePasswords);
  });

  // Authenticated workspace routes (versioned /api/v1 prefix — canonical going forward)
  app.register(async (v1Routes) => {
    v1Routes.addHook('preHandler', checkFastifyAuth);

    v1Routes.get('/api/v1/data/sales', getSalesReport);
    v1Routes.get('/api/v1/data/debitors', getDebitorsReport);
    v1Routes.post('/api/v1/trigger-pipeline', triggerPipeline);
    v1Routes.post('/api/v1/chat', { preHandler: validateBody(chatSchema) }, handleAdvisorChat);
    v1Routes.post('/api/v1/security/verify-upload', { preHandler: validateBody(verifyUploadSchema) }, verifyUploadPasscode);
    v1Routes.post('/api/v1/ledger/upload', handleFileUpload);
    v1Routes.post('/api/v1/security/change', { preHandler: validateBody(changePasswordsSchema) }, changePasswords);
  });

  return app;
}

