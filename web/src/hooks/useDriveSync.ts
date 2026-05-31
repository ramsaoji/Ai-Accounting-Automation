import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { triggerDriveSync, fetchAccountingData, fetchSyncStatus } from '@/services/api';
import type { MasterSummary } from '@/types';

interface UseDriveSyncProps {
  salesData: MasterSummary | null;
  debitorsData: MasterSummary | null;
  connectionMode?: 'live' | 'static' | 'empty';
  fetchRealData: (silent?: boolean) => Promise<any>;
}

export function useDriveSync({ salesData, debitorsData, fetchRealData }: UseDriveSyncProps) {
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up sync polling interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleDriveSync = useCallback(async () => {
    if (isSyncingDrive) return;
    
    setIsSyncingDrive(true);
    setSyncProgress(null);

    const initMsg = 'Initiating Google Drive sync...';
    const upToDateMsg = 'Drive is up-to-date. No changes detected since last sync.';
    const successMsg = 'Google Drive sync completed! Dashboard updated.';
    const failMsg = 'Drive sync failed';

    // Show a temporary info toast that automatically dismisses
    const toastId = toast.info(initMsg, { duration: 2500 });

    // Capture timestamps before sync to detect changes
    const initialSalesTime = salesData?.runTimestamp;
    const initialDebitorsTime = debitorsData?.runTimestamp;

    try {
      const result = await triggerDriveSync(false);

      // Edge case 1: Drive is already up-to-date — no new files, no need to refresh data
      if (result.status === 'up-to-date') {
        setIsSyncingDrive(false);
        setSyncProgress(null);
        toast.dismiss(toastId);
        toast.success(upToDateMsg);
        return;
      }

      // Backend confirmed new files found — dismiss initial connection toast
      // The DriveSyncProgressCard will handle all subsequent visual feedback
      toast.dismiss(toastId);

      setSyncProgress({
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        statusText: 'Connecting to Google Drive...',
        files: []
      });

      let attempts = 0;
      const maxAttempts = 48; // 2 minutes max (48 × 2.5s)

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(async () => {
        attempts++;
        try {
          // 1. Check job execution status on the backend
          const statusResult = await fetchSyncStatus();

          if (statusResult.progress) {
            setSyncProgress({
              ...statusResult.progress,
              errorMsg: statusResult.error || null
            });
          } else if (statusResult.error) {
            setSyncProgress((prev: any) => ({
              ...(prev || { totalFiles: 0, processedFiles: 0, currentFile: '', statusText: 'Drive sync failed', files: [] }),
              errorMsg: statusResult.error
            }));
          }

          if (statusResult.status === 'success') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            await fetchRealData(true); // silent refresh
            toast.success(successMsg);
            setIsSyncingDrive(false);
            return;
          }

          if (statusResult.status === 'error') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            toast.error(`${failMsg}: ${statusResult.error || 'Server error.'}`);
            setIsSyncingDrive(false);
            return;
          }

          if (statusResult.status === 'running') {
            return;
          }

          // 2. Fallback check: query data timestamp changes
          const syncResult = await fetchAccountingData();
          const newSalesTime = syncResult.sales?.runTimestamp;
          const newDebitorsTime = syncResult.debitors?.runTimestamp;

          const salesUpdated = !!(newSalesTime && newSalesTime !== initialSalesTime);
          const debitorsUpdated = !!(newDebitorsTime && newDebitorsTime !== initialDebitorsTime);
          const emptyGotData = !(salesData || debitorsData) && !!(syncResult.sales || syncResult.debitors);

          if (salesUpdated || debitorsUpdated || emptyGotData) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            await fetchRealData(true);
            toast.success(successMsg);
            setIsSyncingDrive(false);

          } else if (attempts >= maxAttempts) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            await fetchRealData(true);
            toast.info('Sync is still processing. Dashboard refreshed with latest available data.');
            setIsSyncingDrive(false);
          }

        } catch {
          if (attempts >= maxAttempts) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            toast.error('Sync polling timed out due to a network error. Please retry.');
            setIsSyncingDrive(false);
            setSyncProgress((prev: any) => ({
              ...(prev || { totalFiles: 0, processedFiles: 0, currentFile: '', statusText: 'Sync failed', files: [] }),
              errorMsg: 'Sync polling timed out due to a network error. Please retry.'
            }));
          }
        }
      }, 2500);

    } catch (err: unknown) {
      setIsSyncingDrive(false);
      setSyncProgress(null);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.dismiss(toastId);
      toast.error(`${failMsg}: ${errMsg}`);
    }
  }, [isSyncingDrive, salesData, debitorsData, fetchRealData]);

  const resetDriveSync = useCallback(() => {
    setIsSyncingDrive(false);
    setSyncProgress(null);
  }, []);

  return {
    isSyncingDrive,
    syncProgress,
    setSyncProgress,
    handleDriveSync,
    resetDriveSync
  };
}
