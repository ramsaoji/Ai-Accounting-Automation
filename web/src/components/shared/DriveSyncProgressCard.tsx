/**
 * DriveSyncProgressCard — thin wrapper over IngestionProgressModal for Drive sync flow.
 * Converts the raw syncProgress object into the unified IngestionProgress format.
 */
import React, { useMemo } from 'react';
import { IngestionProgressModal } from './IngestionProgressModal';
import type { IngestionProgress } from '@/types/ingestion';

interface SyncProgressData {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  statusText: string;
  files: { name: string; status: 'pending' | 'processing' | 'success' | 'error'; error?: string }[];
  errorMsg?: string | null;
}

interface DriveSyncProgressCardProps {
  isSyncing: boolean;
  progress: SyncProgressData | null;
  onClose: () => void;
}

export const DriveSyncProgressCard: React.FC<DriveSyncProgressCardProps> = ({
  isSyncing,
  progress,
  onClose,
}) => {
  const normalized = useMemo<IngestionProgress | null>(() => {
    if (!progress) return null;
    const total = progress?.totalFiles ?? 0;
    const processed = progress?.processedFiles ?? 0;
    return {
      mode: 'drive',
      files: progress?.files ?? [],
      percent: total > 0 ? Math.round((processed / total) * 100) : 0,
      statusText: progress?.statusText ?? 'Connecting to Google Drive...',
      currentFile: progress?.currentFile ?? '',
      isComplete: !isSyncing,
      errorMsg: progress?.errorMsg || null,
    };
  }, [isSyncing, progress]);

  if (!normalized) return null;

  return (
    <IngestionProgressModal
      progress={normalized}
      isActive={isSyncing}
      onClose={onClose}
    />
  );
};
