import { useState, useEffect, useCallback } from 'react';
import type { MasterSummary } from '../types';
import { fetchAccountingData, fetchSystemHealth } from '../services/api';
import { toast } from 'sonner';

export function useAccountingData() {
  const [salesData, setSalesData] = useState<MasterSummary | null>(null);
  const [debitorsData, setDebitorsData] = useState<MasterSummary | null>(null);
  const [connectionMode, setConnectionMode] = useState<'live' | 'static' | 'empty'>('empty');
  const [cronSchedule, setCronSchedule] = useState<string>('0 0 * * *');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const sync = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchAccountingData();
      setSalesData(result.sales);
      setDebitorsData(result.debitors);
      setConnectionMode(result.mode);
      
      if (result.mode === 'live') {
        if (result.sales || result.debitors) {
          toast.success("Successfully synced live data from accounting server.");
        }
        // Fetch cron schedule
        const health = await fetchSystemHealth();
        if (health && health.cron) {
          setCronSchedule(health.cron);
        }
      } else if (result.mode === 'static') {
        toast.success("Loaded offline static sync data (Hotel Gaurav Excel).");
      } else {
        toast.info("Console ready. Upload Excel sheets to begin.");
      }
    } catch (error) {
      console.error("Critical error in accounting sync hook:", error);
      toast.error("An error occurred while syncing accounting data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    sync();
  }, [sync]);

  return {
    salesData,
    debitorsData,
    connectionMode,
    cronSchedule,
    isLoading,
    sync
  };
}
