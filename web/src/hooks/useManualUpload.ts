import { useState, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import { uploadSpreadsheet } from '@/services/api';
import type { IngestionFile, IngestionProgress } from '@/types/ingestion';

interface UseManualUploadProps {
  onSuccess: (silent?: boolean) => Promise<void>;
  isSyncingDriveRef?: RefObject<boolean>;
}

export function useManualUpload({ onSuccess, isSyncingDriveRef }: UseManualUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<IngestionProgress | null>(null);
  const isUploadingRef = useRef(false);

  const startUpload = useCallback(async (files: File[], sessionToken: string) => {
    if (isUploading || isUploadingRef.current || files.length === 0) return;
    if (isSyncingDriveRef?.current) {
      toast.warning("Manual file upload cannot be initiated while a Google Drive sync is in progress.");
      return;
    }

    isUploadingRef.current = true;
    setIsUploading(true);

    // Build initial progress with all files pending
    const initialFiles: IngestionFile[] = files.map((f) => ({
      name: f.name,
      size: f.size,
      status: 'pending',
    }));

    setUploadProgress({
      mode: 'upload',
      files: initialFiles,
      percent: 0,
      statusText: 'Preparing upload...',
      currentFile: '',
      isComplete: false,
      errorMsg: null,
    });

    const progressFiles = [...initialFiles];
    let errorOccurred = false;
    let lastError: string | null = null;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Mark current file as processing
        progressFiles[i] = { ...progressFiles[i], status: 'processing' };
        const overallStart = (i / files.length) * 100;
        const weight = 100 / files.length;

        setUploadProgress({
          mode: 'upload',
          files: [...progressFiles],
          percent: Math.round(overallStart + weight * 0.3),
          statusText: `Uploading ${file.name}...`,
          currentFile: file.name,
          isComplete: false,
          errorMsg: null,
        });

        // Mid-progress: AI processing phase
        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                percent: Math.round(overallStart + weight * 0.7),
                statusText: `AI auditor indexing ${file.name}...`,
              }
            : prev
        );

        try {
          await uploadSpreadsheet(file, sessionToken);
          progressFiles[i] = { ...progressFiles[i], status: 'success' };
        } catch (fileErr) {
          const errMsg = fileErr instanceof Error ? fileErr.message : 'Upload failed';
          progressFiles[i] = { ...progressFiles[i], status: 'error', error: errMsg };
          lastError = errMsg;
          errorOccurred = true;
        }

        setUploadProgress({
          mode: 'upload',
          files: [...progressFiles],
          percent: Math.round(((i + 1) / files.length) * 100),
          statusText: progressFiles[i].status === 'success'
            ? `${file.name} indexed successfully.`
            : `Failed to process ${file.name}.`,
          currentFile: file.name,
          isComplete: false,
          errorMsg: null,
        });
      }

      // Final state
      if (errorOccurred) {
        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                isComplete: true,
                statusText: 'Some files failed to upload. Check details below.',
                errorMsg: lastError,
              }
            : prev
        );
        toast.error(`Ingestion completed with errors: ${lastError}`);
      } else {
        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                percent: 100,
                isComplete: true,
                statusText: `All ${files.length} spreadsheet${files.length !== 1 ? 's' : ''} indexed successfully!`,
                errorMsg: null,
              }
            : prev
        );
        toast.success(`Successfully uploaded ${files.length} spreadsheet${files.length !== 1 ? 's' : ''}.`);
        // Silently refresh dashboard data
        await onSuccess(true);
      }
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
  }, [isUploading, onSuccess, isSyncingDriveRef]);

  const resetUpload = useCallback(() => {
    isUploadingRef.current = false;
    setIsUploading(false);
    setUploadProgress(null);
  }, []);

  return {
    isUploading,
    uploadProgress,
    startUpload,
    resetUpload,
  };
}
