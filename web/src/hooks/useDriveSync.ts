import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { triggerDriveSync, fetchAccountingData } from '@/services/api';
import type { MasterSummary } from '@/types';

interface UseDriveSyncProps {
  salesData: MasterSummary | null;
  debitorsData: MasterSummary | null;
  fetchRealData: (silent?: boolean) => Promise<any>;
}

export function useDriveSync({ salesData, debitorsData, fetchRealData }: UseDriveSyncProps) {
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
    const toastId = toast.loading('Initiating Google Drive sync...');

    // Capture timestamps before sync to detect changes
    const initialSalesTime = salesData?.runTimestamp;
    const initialDebitorsTime = debitorsData?.runTimestamp;

    try {
      const result = await triggerDriveSync();

      // Edge case 1: Drive is already up-to-date — no new files, no need to refresh data
      if (result.status === 'up-to-date') {
        setIsSyncingDrive(false);
        toast.success('Drive is up-to-date. No changes detected since last sync.', { id: toastId });
        return;
      }

      // Backend confirmed new files found — start background ingestion polling
      toast.loading('Ingesting new spreadsheets from Google Drive...', { id: toastId });

      let attempts = 0;
      const maxAttempts = 48; // 2 minutes max (48 × 2.5s)

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const syncResult = await fetchAccountingData();
          const newSalesTime = syncResult.sales?.runTimestamp;
          const newDebitorsTime = syncResult.debitors?.runTimestamp;

          // Detect if backend has finished writing new data to DB
          const salesUpdated = !!(newSalesTime && newSalesTime !== initialSalesTime);
          const debitorsUpdated = !!(newDebitorsTime && newDebitorsTime !== initialDebitorsTime);
          // Edge case 2: Dashboard was previously empty, now has data
          const emptyGotData = !(salesData || debitorsData) && !!(syncResult.sales || syncResult.debitors);

          if (salesUpdated || debitorsUpdated || emptyGotData) {
            // Success: new data detected — silently refresh dashboard state without loading spinner
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            await fetchRealData(true); // silent refresh — no spinner, no duplicate toast
            toast.success('Google Drive sync completed! Dashboard updated.', { id: toastId });

          } else if (attempts >= maxAttempts) {
            // Edge case 3: Timeout — ingestion is taking too long
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            await fetchRealData(true); // silent refresh — show whatever is in DB now
            toast.info('Sync is still processing. Dashboard refreshed with latest available data.', { id: toastId });
          }
          // Otherwise: still waiting — no action, polling continues silently

        } catch {
          // Edge case 4: Polling network error
          if (attempts >= maxAttempts) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSyncingDrive(false);
            toast.error('Sync polling timed out due to a network error. Please retry.', { id: toastId });
          }
          // Otherwise: transient error — will retry on next interval tick
        }
      }, 2500);

    } catch (err: unknown) {
      // Edge case 5: triggerDriveSync itself threw (network down, server error)
      setIsSyncingDrive(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Drive sync failed: ${errMsg}`, { id: toastId });
    }
  }, [isSyncingDrive, salesData, debitorsData, fetchRealData]);

  return {
    isSyncingDrive,
    handleDriveSync
  };
}
