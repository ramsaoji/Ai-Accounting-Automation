import { useState, useCallback, useRef } from 'react';
import type { MasterSummary } from '../types';
import { fetchAccountingData, fetchSystemHealth } from '../services/api';
import { toast } from 'sonner';
import { BUSINESS_NAME } from '../utils/business';

export function useAccountingData() {
  const [salesData, setSalesData] = useState<MasterSummary | null>(null);
  const [debitorsData, setDebitorsData] = useState<MasterSummary | null>(null);
  const [connectionMode, setConnectionMode] = useState<'live' | 'static' | 'empty'>('empty');
  const [cronSchedule, setCronSchedule] = useState<string>('0 0 * * *');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const lastSalesTimestamp = useRef<string | undefined>(undefined);
  const lastDebitorsTimestamp = useRef<string | undefined>(undefined);
  const hasInitiallySynced = useRef<boolean>(false);

  /**
   * Fetches latest accounting data and updates UI state.
   * @param silent - When true, skips the loading spinner and duplicate success toasts.
   *                 Use this for background refreshes (e.g. after drive sync polling) so the
   *                 full-page loading screen is not triggered on an already-loaded dashboard.
   */
  const sync = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const result = await fetchAccountingData();

      const salesChanged = result.sales?.runTimestamp !== lastSalesTimestamp.current;
      const debitorsChanged = result.debitors?.runTimestamp !== lastDebitorsTimestamp.current;
      const dataChanged = salesChanged || debitorsChanged;

      lastSalesTimestamp.current = result.sales?.runTimestamp;
      lastDebitorsTimestamp.current = result.debitors?.runTimestamp;

      setSalesData(result.sales);
      setDebitorsData(result.debitors);
      setConnectionMode(result.mode);

      if (!silent) {
        // Only fire toasts during explicit (non-background) refreshes
        if (result.mode === 'live') {
          if ((result.sales || result.debitors) && (!hasInitiallySynced.current || dataChanged)) {
            toast.success(`Successfully synced live data from ${BUSINESS_NAME} accounting server.`);
          }
        } else if (result.mode === 'static') {
          if (!hasInitiallySynced.current) {
            toast.success(`Loaded offline static sync data (${BUSINESS_NAME} Excel).`);
          }
        } else {
          if (!hasInitiallySynced.current) {
            toast.info('Console ready. Upload Excel sheets to begin.');
          }
        }
      }

      hasInitiallySynced.current = true;

      // Always keep cron schedule up to date in live mode
      if (result.mode === 'live') {
        const health = await fetchSystemHealth();
        if (health && health.cron) {
          setCronSchedule(health.cron);
        }
      }
    } catch (error) {
      console.error("Critical error in accounting sync hook:", error);
      if (!silent) {
        toast.error("An error occurred while syncing accounting data.");
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  return {
    salesData,
    debitorsData,
    connectionMode,
    cronSchedule,
    isLoading,
    sync
  };
}
