import { useState, useCallback, useRef } from 'react';
import type { MasterSummary } from '@/types';
import { fetchAccountingData, fetchSystemHealth } from '@/services/api';
import { toast } from 'sonner';

export function useAccountingData() {
  const [salesData, setSalesData] = useState<MasterSummary | null>(null);
  const [debitorsData, setDebitorsData] = useState<MasterSummary | null>(null);
  const [connectionMode, setConnectionMode] = useState<'live' | 'static' | 'empty'>('empty');
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);
  const [isLocalDb, setIsLocalDb] = useState<boolean>(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [hasSyncedBefore, setHasSyncedBefore] = useState<boolean>(false);
  const [cronSchedule, setCronSchedule] = useState<string>('0 0 * * *');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [aiProvider, setAiProvider] = useState<string>('none');

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



      lastSalesTimestamp.current = result.sales?.runTimestamp;
      lastDebitorsTimestamp.current = result.debitors?.runTimestamp;

      setSalesData(result.sales);
      setDebitorsData(result.debitors);
      setConnectionMode(result.mode);
      setIsDbConnected(!!result.isDbConnected);
      setIsLocalDb(!!result.isLocalDb);
      setIsDevMode(!!result.isDevMode);
      setHasSyncedBefore(!!result.hasSyncedBefore);
      setAiProvider(result.aiProvider || 'none');



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
    isDbConnected,
    isLocalDb,
    isDevMode,
    hasSyncedBefore,
    cronSchedule,
    isLoading,
    aiProvider,
    sync
  };
}
