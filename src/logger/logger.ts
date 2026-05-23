import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config.js';

const isDevelopment = config.NODE_ENV === 'development';
const logDir = path.resolve(process.cwd(), 'data', 'output');

// Ensure the output directory exists for log writing
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'system.log');

export const logger = pino(
  {
    level: isDevelopment ? 'debug' : 'info',
  },
  pino.multistream([
    {
      // Pretty-printed console logs for terminal visibility
      stream: pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        },
      }) as any,
    },
    {
      // Append raw JSON logs persistently to a file on disk
      stream: fs.createWriteStream(logFilePath, { flags: 'a' }),
    },
  ])
);
