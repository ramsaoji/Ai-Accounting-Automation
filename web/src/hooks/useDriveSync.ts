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

export function useDriveSync({ salesData, debitorsData, connectionMode = 'static', fetchRealData }: UseDriveSyncProps) {
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
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

    const isStatic = connectionMode === 'static';
    const initMsg = isStatic ? 'Scanning local input directory...' : 'Initiating Google Drive sync...';
    const progressMsg = isStatic ? 'Ingesting spreadsheets from local input directory...' : 'Ingesting new spreadsheets from Google Drive...';
    const upToDateMsg = isStatic ? 'Local files are up-to-date. No new spreadsheets detected.' : 'Drive is up-to-date. No changes detected since last sync.';
    const successMsg = isStatic ? 'Local files load completed! Dashboard updated.' : 'Google Drive sync completed! Dashboard updated.';
    const failMsg = isStatic ? 'Local files load failed' : 'Drive sync failed';

    const toastId = toast.loading(initMsg);

    // Capture timestamps before sync to detect changes
    const initialSalesTime = salesData?.runTimestamp;
    const initialDebitorsTime = debitorsData?.runTimestamp;

    try {
      const result = await triggerDriveSync();

      // Edge case 1: Drive is already up-to-date — no new files, no need to refresh data
      if (result.status === 'up-to-date') {
        setIsSyncingDrive(false);
        toast.success(upToDateMsg, { id: toastId });
        return;
      }

      // Backend confirmed new files found — start background ingestion polling
      toast.loading(progressMsg, { id: toastId });

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

          if (statusResult.status === 'success') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            await fetchRealData(true); // silent refresh
            toast.success(successMsg, { id: toastId });
            return;
          }

          if (statusResult.status === 'error') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            toast.error(`${failMsg}: ${statusResult.error || 'Server error.'}`, { id: toastId });
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
            setIsSyncingDrive(false);
            await fetchRealData(true);
            toast.success(successMsg, { id: toastId });

          } else if (attempts >= maxAttempts) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            await fetchRealData(true);
            toast.info('Sync is still processing. Dashboard refreshed with latest available data.', { id: toastId });
          }

        } catch {
          if (attempts >= maxAttempts) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            toast.error('Sync polling timed out due to a network error. Please retry.', { id: toastId });
          }
        }
      }, 2500);

    } catch (err: unknown) {
      setIsSyncingDrive(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`${failMsg}: ${errMsg}`, { id: toastId });
    }
  }, [isSyncingDrive, salesData, debitorsData, fetchRealData, connectionMode]);

  return {
    isSyncingDrive,
    handleDriveSync
  };
}
