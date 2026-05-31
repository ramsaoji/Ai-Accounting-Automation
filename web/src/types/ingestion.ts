/**
 * Shared ingestion progress types used by both manual upload and Drive sync flows.
 */

export interface IngestionFile {
  name: string;
  size?: number; // bytes, for manual uploads
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface IngestionProgress {
  mode: 'upload' | 'drive';
  files: IngestionFile[];
  percent: number;
  statusText: string;
  currentFile: string;
  isComplete: boolean;
  errorMsg?: string | null;
}
