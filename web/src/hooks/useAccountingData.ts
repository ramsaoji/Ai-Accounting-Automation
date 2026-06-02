import { useState, useCallback, useRef } from 'react';
import type { MasterSummary } from '@/types';
import { fetchPortalSummary, authFetch, apiBaseUrl, getAuthHeaders, mapMasterSummary } from '@/services/api';
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
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState<boolean>(false);
  const [aiProvider, setAiProvider] = useState<string>('none');

  const lastSalesTimestamp = useRef<string | undefined>(undefined);
  const lastDebitorsTimestamp = useRef<string | undefined>(undefined);
  const hasInitiallySynced = useRef<boolean>(false);
  const syncRequestId = useRef<number>(0);

  /**
   * Fetches portal-summary data registers.
   * Resolves immediately to display dashboard frames and widgets under 200ms.
   */
  const sync = useCallback(async (silent = false) => {
    const currentRequestId = ++syncRequestId.current;
    if (!silent && !hasInitiallySynced.current) {
      setIsLoading(true);
    }
    try {
      const result = await fetchPortalSummary();
      if (currentRequestId !== syncRequestId.current) {
        return; // Discard stale request responses
      }

      setConnectionMode(result.mode);
      setIsDbConnected(!!result.isDbConnected);
      setIsLocalDb(!!result.isLocalDb);
      setIsDevMode(!!result.isDevMode);
      setHasSyncedBefore(!!result.hasSyncedBefore);
      setAiProvider(result.aiProvider || 'none');

      if (result.cronSchedule) {
        setCronSchedule(result.cronSchedule);
      }

      // Map portal summary to minimal MasterSummary objects to let PortalSection render instantly out-of-the-box
      if (result.sales) {
        setSalesData((prev) => {
          // If we already have full sales report loaded, don't overwrite it with a minimal one
          if (prev && prev.benchmarks) return prev;
          
          return {
            fileName: result.sales!.fileName,
            runTimestamp: result.sales!.runTimestamp,
            totalTransactions: result.sales!.totalTransactions,
            totalMonths: result.sales!.totalMonths,
            masterTotals: {
              totalInflows: result.sales!.totalInflows,
              netCashflow: result.sales!.netCashflow,
            },
            months: result.sales!.sparkline.map((net: number) => ({ net })),
            alerts: Array(result.sales!.alertCount).fill({}),
            transactions: [],
            errors: [],
            intelligence: [],
            aiGenerated: false
          } as any;
        });
        lastSalesTimestamp.current = result.sales.runTimestamp;
      } else {
        setSalesData(null);
        lastSalesTimestamp.current = undefined;
      }

      if (result.debitors) {
        setDebitorsData((prev) => {
          // If we already have full debitors report loaded, don't overwrite it
          if (prev && prev.aggregates?.totalDebitSum !== undefined) return prev;
          
          return {
            fileName: result.debitors!.fileName,
            runTimestamp: result.debitors!.runTimestamp,
            totalTransactions: result.debitors!.totalTransactions,
            aggregates: {
              totalPendingSum: result.debitors!.totalPendingSum,
              collectionSuccessRate: result.debitors!.collectionSuccessRate,
              activeDebitorsCount: result.debitors!.activeDebitorsCount,
            },
            topDebitors: result.debitors!.sparkline.map((pending: number) => ({ pending })),
            alerts: Array(result.debitors!.alertCount).fill({}),
            transactions: [],
            errors: [],
            intelligence: [],
            aiGenerated: false
          } as any;
        });
        lastDebitorsTimestamp.current = result.debitors.runTimestamp;
      } else {
        setDebitorsData(null);
        lastDebitorsTimestamp.current = undefined;
      }

      hasInitiallySynced.current = true;
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

  /**
   * Lazy load the complete transactions and analytics report for a specific workspace console view.
   */
  const fetchWorkspaceData = useCallback(async (workspace: 'sales' | 'debitors') => {
    setIsWorkspaceLoading(true);
    try {
      if (workspace === 'sales') {
        const res = await authFetch(`${apiBaseUrl}/api/v1/data/sales`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = mapMasterSummary(await res.json(), false);
          setSalesData(data);
        }
      } else {
        const res = await authFetch(`${apiBaseUrl}/api/v1/data/debitors`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = mapMasterSummary(await res.json(), true);
          setDebitorsData(data);
        }
      }
    } catch (error) {
      console.error(`Failed to load full workspace data for ${workspace}:`, error);
      toast.error(`An error occurred while loading full ${workspace} data.`);
    } finally {
      setIsWorkspaceLoading(false);
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
    isWorkspaceLoading,
    aiProvider,
    sync,
    fetchWorkspaceData
  };
}
