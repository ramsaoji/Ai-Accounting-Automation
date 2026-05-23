import { google } from 'googleapis';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

/**
 * Initializes and returns a Google Drive API client authorized with service account JWT credentials.
 */
export function getDriveClient() {
  try {
    logger.info('Initializing Google Drive Client with Service Account credentials');
    
    const auth = new google.auth.JWT(
      config.GOOGLE_CLIENT_EMAIL,
      undefined,
      config.GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Google Drive Client auth');
    throw new Error(`Google Drive Client initialization failed: ${(error as Error).message}`);
  }
}
export type DriveClient = ReturnType<typeof getDriveClient>;
