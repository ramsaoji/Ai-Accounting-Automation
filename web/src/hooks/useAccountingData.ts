import { useState, useCallback, useRef } from 'react';
import type { MasterSummary } from '../types';
import { fetchAccountingData, fetchSystemHealth } from '../services/api';
import { toast } from 'sonner';

export function useAccountingData() {
  const [salesData, setSalesData] = useState<MasterSummary | null>(null);
  const [debitorsData, setDebitorsData] = useState<MasterSummary | null>(null);
  const [connectionMode, setConnectionMode] = useState<'live' | 'static' | 'empty'>('empty');
  const [cronSchedule, setCronSchedule] = useState<string>('0 0 * * *');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const lastSalesTimestamp = useRef<string | undefined>(undefined);
  const lastDebitorsTimestamp = useRef<string | undefined>(undefined);
  const hasInitiallySynced = useRef<boolean>(false);

  const sync = useCallback(async () => {
    setIsLoading(true);
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
      
      if (result.mode === 'live') {
        if ((result.sales || result.debitors) && (!hasInitiallySynced.current || dataChanged)) {
          toast.success("Successfully synced live data from accounting server.");
        }
        hasInitiallySynced.current = true;
        // Fetch cron schedule
        const health = await fetchSystemHealth();
        if (health && health.cron) {
          setCronSchedule(health.cron);
        }
      } else if (result.mode === 'static') {
        if (!hasInitiallySynced.current) {
          toast.success("Loaded offline static sync data (Hotel Gaurav Excel).");
        }
        hasInitiallySynced.current = true;
      } else {
        if (!hasInitiallySynced.current) {
          toast.info("Console ready. Upload Excel sheets to begin.");
        }
        hasInitiallySynced.current = true;
      }
    } catch (error) {
      console.error("Critical error in accounting sync hook:", error);
      toast.error("An error occurred while syncing accounting data.");
    } finally {
      setIsLoading(false);
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
