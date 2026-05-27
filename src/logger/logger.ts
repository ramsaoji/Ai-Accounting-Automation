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

const streams: pino.StreamEntry[] = [
  {
    // Append raw JSON logs persistently to a file on disk
    stream: fs.createWriteStream(logFilePath, { flags: 'a' }),
  },
];

if (isDevelopment) {
  streams.push({
    // Pretty-printed console logs for local terminal visibility
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      },
    }) as any,
  });
} else {
  streams.push({
    // High-performance raw JSON logs for production aggregators
    stream: process.stdout,
  });
}

export const logger = pino(
  {
    level: isDevelopment ? 'debug' : 'info',
  },
  pino.multistream(streams)
);
