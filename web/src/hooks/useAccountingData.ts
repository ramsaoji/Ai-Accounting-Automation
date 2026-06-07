import { useState, useCallback, useRef, useEffect } from 'react';
import type { MasterSummary } from '@/types';
import { fetchPortalSummary, authFetch, apiBaseUrl, getAuthHeaders, mapMasterSummary } from '@/services/api';
import { toast } from 'sonner';

export function useAccountingData() {
  const [salesData, setSalesData] = useState<MasterSummary | null>(null);
  const [debitorsData, setDebitorsData] = useState<MasterSummary | null>(null);
  const [godownStockData, setGodownStockData] = useState<MasterSummary | null>(null);
  const [counterStockData, setCounterStockData] = useState<MasterSummary | null>(null);
  const [connectionMode, setConnectionMode] = useState<'live' | 'static' | 'empty'>('empty');
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);
  const [isLocalDb, setIsLocalDb] = useState<boolean>(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [hasSyncedBefore, setHasSyncedBefore] = useState<boolean>(false);
  const [cronSchedule, setCronSchedule] = useState<string>('0 0 * * *');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState<boolean>(false);
  const [aiProvider, setAiProvider] = useState<string>('none');

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.aiProvider) {
        setAiProvider(customEvent.detail.aiProvider);
      }
    };
    window.addEventListener('system-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('system-settings-updated', handleSettingsUpdated);
    };
  }, []);

  const lastSalesTimestamp = useRef<string | undefined>(undefined);
  const lastDebitorsTimestamp = useRef<string | undefined>(undefined);
  const lastGodownStockTimestamp = useRef<string | undefined>(undefined);
  const lastCounterStockTimestamp = useRef<string | undefined>(undefined);
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
        const isNewFile = lastSalesTimestamp.current !== result.sales.runTimestamp;
        setSalesData((prev) => {
          // If we already have full sales report loaded, don't overwrite it with a minimal one
          if (prev && prev.benchmarks && !isNewFile) return prev;
          
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
            highAlertCount: result.sales!.highAlertCount ?? result.sales!.alertCount,
            dateRange: result.sales!.dateRange ?? null,
            transactions: [],
            errors: [],
            intelligence: result.sales!.intelligence ?? [],
            aiGenerated: false
          } as any;
        });
        lastSalesTimestamp.current = result.sales.runTimestamp;
      } else {
        setSalesData(null);
        lastSalesTimestamp.current = undefined;
      }

      if (result.debitors) {
        const isNewFile = lastDebitorsTimestamp.current !== result.debitors.runTimestamp;
        setDebitorsData((prev) => {
          // If we already have full debitors report loaded, don't overwrite it
          if (prev && prev.aggregates?.totalDebitSum !== undefined && !isNewFile) return prev;
          
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
            highAlertCount: result.debitors!.highAlertCount ?? result.debitors!.alertCount,
            dateRange: result.debitors!.dateRange ?? null,
            transactions: [],
            errors: [],
            intelligence: result.debitors!.intelligence ?? [],
            aiGenerated: false
          } as any;
        });
        lastDebitorsTimestamp.current = result.debitors.runTimestamp;
      } else {
        setDebitorsData(null);
        lastDebitorsTimestamp.current = undefined;
      }

      if (result.godownStock) {
        const isNewFile = lastGodownStockTimestamp.current !== result.godownStock.runTimestamp;
        setGodownStockData((prev) => {
          if (prev && prev.aggregates?.totalClosingValue !== undefined && !isNewFile) return prev;
          
          return {
            fileName: result.godownStock!.fileName,
            runTimestamp: result.godownStock!.runTimestamp,
            totalTransactions: result.godownStock!.totalItems,
            aggregates: {
              totalClosingValue: result.godownStock!.totalClosingValue,
              totalSellingValue: result.godownStock!.totalSellingValue,
              activeItemsCount: result.godownStock!.activeItemsCount,
            },
            historicalTrends: result.godownStock!.sparkline.map((val: number) => ({ totalCostValue: val })),
            alerts: Array(result.godownStock!.alertCount).fill({}),
            highAlertCount: result.godownStock!.highAlertCount ?? result.godownStock!.alertCount,
            dateRange: result.godownStock!.dateRange ?? null,
            items: [],
            errors: [],
            intelligence: result.godownStock!.intelligence ?? [],
            aiGenerated: false
          } as any;
        });
        lastGodownStockTimestamp.current = result.godownStock.runTimestamp;
      } else {
        setGodownStockData(null);
        lastGodownStockTimestamp.current = undefined;
      }

      if (result.counterStock) {
        const isNewFile = lastCounterStockTimestamp.current !== result.counterStock.runTimestamp;
        setCounterStockData((prev) => {
          if (prev && prev.aggregates?.totalClosingValue !== undefined && !isNewFile) return prev;
          
          return {
            fileName: result.counterStock!.fileName,
            runTimestamp: result.counterStock!.runTimestamp,
            totalTransactions: result.counterStock!.totalItems,
            aggregates: {
              totalClosingValue: result.counterStock!.totalClosingValue,
              totalSellingValue: result.counterStock!.totalSellingValue,
              activeItemsCount: result.counterStock!.activeItemsCount,
            },
            historicalTrends: result.counterStock!.sparkline.map((val: number) => ({ totalCostValue: val })),
            alerts: Array(result.counterStock!.alertCount).fill({}),
            highAlertCount: result.counterStock!.highAlertCount ?? result.counterStock!.alertCount,
            dateRange: result.counterStock!.dateRange ?? null,
            items: [],
            errors: [],
            intelligence: result.counterStock!.intelligence ?? [],
            aiGenerated: false
          } as any;
        });
        lastCounterStockTimestamp.current = result.counterStock.runTimestamp;
      } else {
        setCounterStockData(null);
        lastCounterStockTimestamp.current = undefined;
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
  const fetchWorkspaceData = useCallback(async (workspace: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock') => {
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
      } else if (workspace === 'debitors') {
        const res = await authFetch(`${apiBaseUrl}/api/v1/data/debitors`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = mapMasterSummary(await res.json(), true);
          setDebitorsData(data);
        }
      } else if (workspace === 'godown_stock') {
        const res = await authFetch(`${apiBaseUrl}/api/v1/data/godown-stock`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = mapMasterSummary(await res.json(), false);
          setGodownStockData(data);
        }
      } else if (workspace === 'counter_stock') {
        const res = await authFetch(`${apiBaseUrl}/api/v1/data/counter-stock`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = mapMasterSummary(await res.json(), false);
          setCounterStockData(data);
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
    godownStockData,
    counterStockData,
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
