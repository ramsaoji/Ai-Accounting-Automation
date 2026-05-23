import { drive_v3 } from 'googleapis';
import { getDriveClient } from './drive.client.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

export interface DriveFileInfo {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
}

export class DriveService {
  private drive: drive_v3.Drive;

  constructor() {
    this.drive = getDriveClient();
  }

  /**
   * Lists the latest .xlsx accounting files inside the configured Google Drive folder.
   * Returns metadata for the newest file or null if no matching files are found.
   */
  async getLatestExcelFile(): Promise<DriveFileInfo | null> {
    try {
      const folderId = config.GOOGLE_DRIVE_FOLDER_ID;
      logger.info({ folderId }, 'Searching for the latest Excel file in Google Drive');

      // Query to search for files inside specific folder, matching Excel mimeType, not trashed
      const q = `'${folderId}' in parents and mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed = false`;

      const response = await this.drive.files.list({
        q,
        spaces: 'drive',
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc', // Get the latest modified file
        pageSize: 5,                  // Retrieve a small batch to inspect
      });

      const files = response.data.files;
      if (!files || files.length === 0) {
        logger.warn({ folderId }, 'No Excel files found in the configured folder');
        return null;
      }

      // Return the most recently modified file
      const latestFile = files[0];
      logger.info(
        { 
          fileId: latestFile.id, 
          fileName: latestFile.name, 
          modifiedTime: latestFile.modifiedTime 
        }, 
        'Found latest accounting Excel file'
      );

      return {
        id: latestFile.id!,
        name: latestFile.name!,
        createdTime: latestFile.createdTime || undefined,
        modifiedTime: latestFile.modifiedTime || undefined,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve files from Google Drive');
      throw new Error(`Google Drive list failed: ${(error as Error).message}`);
    }
  }

  /**
   * Downloads a file from Google Drive by its file ID and returns it as a Buffer.
   */
  async downloadFile(fileId: string, fileName: string): Promise<Buffer> {
    try {
      logger.info({ fileId, fileName }, 'Downloading file buffer from Google Drive');

      const response = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        {
          responseType: 'arraybuffer',
        }
      );

      if (!response.data) {
        throw new Error('Received empty data buffer from Google Drive download');
      }

      const buffer = Buffer.from(response.data as ArrayBuffer);
      logger.info({ sizeBytes: buffer.length }, 'Successfully downloaded Excel buffer');
      return buffer;
    } catch (error) {
      logger.error({ error, fileId }, 'Failed to download file from Google Drive');
      throw new Error(`Google Drive download failed for file ID ${fileId}: ${(error as Error).message}`);
    }
  }
}
export const driveService = new DriveService();
