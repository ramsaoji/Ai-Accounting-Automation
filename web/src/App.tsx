import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

import { useTheme } from '@/providers/theme-provider';
import { useAccountingStore } from '@/store/useAccountingStore';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useDriveSync } from '@/hooks/useDriveSync';
import { useManualUpload } from '@/hooks/useManualUpload';
import { IngestionProgressModal } from '@/components/shared/IngestionProgressModal';
import { LockScreen } from '@/components/security/LockScreen';
import { checkSessionStatus, logoutUser } from '@/services/api';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { OnboardingWizard } from '@/components/shared/OnboardingWizard';
import { DriveSyncProgressCard } from '@/components/shared/DriveSyncProgressCard';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { Header } from '@/components/layout/Header';
import { EmptyWorkspaceState } from '@/components/sections/EmptyWorkspaceState';
import { deriveBusinessName } from '@/utils/business';

// Lazy load layout sections and modals for bundle optimizations
const PortalSection = lazy(() => import('@/components/sections/portal/PortalSection').then(m => ({ default: m.PortalSection })));
const OverviewSection = lazy(() => import('@/components/sections/overview/OverviewSection').then(m => ({ default: m.OverviewSection })));
const LedgerSection = lazy(() => import('@/components/sections/ledger/LedgerSection').then(m => ({ default: m.LedgerSection })));
const AuditorSection = lazy(() => import('@/components/sections/auditor/AuditorSection').then(m => ({ default: m.AuditorSection })));
const AdvisorSection = lazy(() => import('@/components/sections/advisor/AdvisorSection').then(m => ({ default: m.AdvisorSection })));
const SecuritySettingsModal = lazy(() => import('@/components/security/SecuritySettingsModal').then(m => ({ default: m.SecuritySettingsModal })));
const HistoryRetentionModal = lazy(() => import('@/components/security/HistoryRetentionModal').then(m => ({ default: m.HistoryRetentionModal })));


export function App() {
  const { theme, setTheme } = useTheme();

  // Zustand Store selectors
  const appSessionToken = useAccountingStore((state) => state.appSessionToken);
  const activeWorkspace = useAccountingStore((state) => state.activeWorkspace);
  const activeView = useAccountingStore((state) => state.activeView);
  const setToken = useAccountingStore((state) => state.setToken);
  const clearToken = useAccountingStore((state) => state.clearToken);
  const setActiveWorkspace = useAccountingStore((state) => state.setActiveWorkspace);
  const setActiveView = useAccountingStore((state) => state.setActiveView);

  // Dynamically update document title from environment variable
  useEffect(() => {
    document.title = `${deriveBusinessName()} | Financial Command Center`;
  }, []);



  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isRetentionOpen, setIsRetentionOpen] = useState(false);
  const [securityModalInitialTab, setSecurityModalInitialTab] = useState<'app-lock' | 'upload' | 'system-settings'>('app-lock');

  const handleOpenSecuritySettings = (tab: 'app-lock' | 'upload' | 'system-settings' | 'history-retention' = 'app-lock') => {
    if (tab === 'history-retention') {
      setIsRetentionOpen(true);
    } else {
      setSecurityModalInitialTab(tab as any);
      setIsSecurityOpen(true);
    }
  };

  // Query status of the HttpOnly session cookie on initial app mount
  useEffect(() => {
    checkSessionStatus()
      .then((isValid) => {
        if (isValid) {
          setToken('active');
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken());
  }, [setToken, clearToken]);

  const handleLogout = async () => {
    await logoutUser();
    clearToken();
    toast.info("Application locked successfully.");
  };

  // Listen for global session expiry events (e.g. backend restarts or token expiration)
  useEffect(() => {
    const handleAuthUnauthorized = () => {
      clearToken();
      toast.error("Administrative session expired or invalid. Console locked.");
    };
    window.addEventListener('auth-unauthorized', handleAuthUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleAuthUnauthorized);
    };
  }, [clearToken]);

  const mainRef = useRef<HTMLDivElement>(null);

  // Scroll to top on activeView or activeWorkspace change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeView, activeWorkspace]);

  // Load real database data with modular 3-tier cascading fallback hook
  const { salesData, debitorsData, godownStockData, counterStockData, connectionMode, isDbConnected, isLocalDb, hasSyncedBefore, cronSchedule, isLoading, isWorkspaceLoading, aiProvider, sync: fetchRealData, fetchWorkspaceData } = useAccountingData();

  const isSyncingDriveRef = useRef(false);
  const isUploadingRef = useRef(false);
  const hasInitializedWorkspaceRef = useRef(false);

  // Reset initialization flag when user locks/logs out of the console
  useEffect(() => {
    if (!appSessionToken) {
      hasInitializedWorkspaceRef.current = false;
    }
  }, [appSessionToken]);

  // Dynamically set default active workspace to the first one that has data on initial load
  useEffect(() => {
    if (!isLoading && !hasInitializedWorkspaceRef.current) {
      const activeData = activeWorkspace === 'sales' ? salesData
        : activeWorkspace === 'debitors' ? debitorsData
        : activeWorkspace === 'godown_stock' ? godownStockData
        : counterStockData;

      if (!activeData) {
        if (salesData) {
          setActiveWorkspace('sales');
          hasInitializedWorkspaceRef.current = true;
        } else if (debitorsData) {
          setActiveWorkspace('debitors');
          hasInitializedWorkspaceRef.current = true;
        } else if (godownStockData) {
          setActiveWorkspace('godown_stock');
          hasInitializedWorkspaceRef.current = true;
        } else if (counterStockData) {
          setActiveWorkspace('counter_stock');
          hasInitializedWorkspaceRef.current = true;
        }
      } else {
        hasInitializedWorkspaceRef.current = true;
      }
    }
  }, [isLoading, salesData, debitorsData, godownStockData, counterStockData, activeWorkspace, setActiveWorkspace]);

  // Custom Drive Sync hook to isolate background polling/interval logic
  const { isSyncingDrive, syncProgress, handleDriveSync, resetDriveSync } = useDriveSync({
    salesData,
    debitorsData,
    connectionMode,
    fetchRealData,
    isUploadingRef
  });

  // Manual upload hook — owns upload logic and progress state
  const { isUploading, uploadProgress, startUpload, resetUpload } = useManualUpload({
    onSuccess: fetchRealData,
    isSyncingDriveRef
  });

  // Sync state values to refs on state change to avoid rendering violations
  useEffect(() => {
    isSyncingDriveRef.current = isSyncingDrive;
  }, [isSyncingDrive]);

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  // Trigger sync on mount if already authenticated
  useEffect(() => {
    if (appSessionToken) {
      fetchRealData();
    }
  }, [appSessionToken, fetchRealData]);

  const relevantFileName = useMemo(() => {
    if (activeWorkspace === 'sales') return salesData?.fileName;
    if (activeWorkspace === 'debitors') return debitorsData?.fileName;
    if (activeWorkspace === 'godown_stock') return godownStockData?.fileName;
    return counterStockData?.fileName;
  }, [activeWorkspace, salesData?.fileName, debitorsData?.fileName, godownStockData?.fileName, counterStockData?.fileName]);

  // Lazy load full reports when user leaves the portal view to enter a specific workspace console
  useEffect(() => {
    if (appSessionToken && activeView !== 'portal') {
      const isSalesFullyLoaded = activeWorkspace === 'sales' && salesData && 'benchmarks' in salesData;
      const isDebitorsFullyLoaded = activeWorkspace === 'debitors' && debitorsData && debitorsData.aggregates && 'totalDebitSum' in debitorsData.aggregates;
      const isGodownStockFullyLoaded = activeWorkspace === 'godown_stock' && godownStockData && 'isGodownStockList' in godownStockData;
      const isCounterStockFullyLoaded = activeWorkspace === 'counter_stock' && counterStockData && 'isGodownStockList' in counterStockData;
      
      if (activeWorkspace === 'sales' && !isSalesFullyLoaded) {
        fetchWorkspaceData('sales');
      } else if (activeWorkspace === 'debitors' && !isDebitorsFullyLoaded) {
        fetchWorkspaceData('debitors');
      } else if (activeWorkspace === 'godown_stock' && !isGodownStockFullyLoaded) {
        fetchWorkspaceData('godown_stock');
      } else if (activeWorkspace === 'counter_stock' && !isCounterStockFullyLoaded) {
        fetchWorkspaceData('counter_stock');
      }
    }
  }, [appSessionToken, activeWorkspace, activeView, fetchWorkspaceData, salesData, debitorsData, godownStockData, counterStockData]);

  const businessName = useMemo(() => {
    const activeFile = activeWorkspace === 'sales' ? salesData
      : activeWorkspace === 'debitors' ? debitorsData
      : activeWorkspace === 'godown_stock' ? godownStockData
      : counterStockData;
    return deriveBusinessName(activeFile?.fileName ?? salesData?.fileName ?? debitorsData?.fileName ?? godownStockData?.fileName ?? counterStockData?.fileName);
  }, [activeWorkspace, salesData?.fileName, debitorsData?.fileName, godownStockData?.fileName, counterStockData?.fileName]);



  // activeSummary points to the currently active dataset
  const activeSummary = activeWorkspace === 'sales' ? salesData : activeWorkspace === 'debitors' ? debitorsData : activeWorkspace === 'godown_stock' ? godownStockData : counterStockData;

  const activeAlerts = useMemo(() => {
    if (activeWorkspace === 'sales') {
      return salesData?.alerts || [];
    } else if (activeWorkspace === 'debitors') {
      return debitorsData?.alerts || [];
    } else if (activeWorkspace === 'godown_stock') {
      return godownStockData?.alerts || [];
    } else {
      return counterStockData?.alerts || [];
    }
  }, [activeWorkspace, salesData, debitorsData, godownStockData, counterStockData]);

  const highAlertsCount = useMemo(() => {
    const activeData = activeWorkspace === 'sales' ? salesData : activeWorkspace === 'debitors' ? debitorsData : activeWorkspace === 'godown_stock' ? godownStockData : counterStockData;
    if (!activeData) return 0;
    if (activeData.highAlertCount !== undefined) {
      return activeData.highAlertCount;
    }
    const HIGH_SEVERITY = new Set(['high', 'critical']);
    return (activeData.alerts || []).filter((a: any) => HIGH_SEVERITY.has(a.severity)).length;
  }, [activeWorkspace, salesData, debitorsData, godownStockData, counterStockData]);

  // Launch workspace callback from portal
  const handleLaunchWorkspace = (workspace: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock', view: 'overview' | 'ledger' | 'auditor' | 'advisor' = 'overview') => {
    setActiveWorkspace(workspace);
    setActiveView(view);
  };

  // App Passcode Lock Screen verification check
  if (!appSessionToken) {
    return (
      <TooltipProvider>
        <LockScreen
          onUnlock={(token, remember) => {
            setToken(token, remember);
          }}
        />
        <Toaster position="top-right" />
      </TooltipProvider>
    );
  }

  // Sync / loading screen placed after hook definitions to respect React Hook guidelines
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Global Onboarding View: if both datasets are empty on clean prod deployment
  if (!salesData && !debitorsData && !godownStockData && !counterStockData) {
    return (
      <TooltipProvider>
        <OnboardingWizard
          connectionMode={connectionMode}
          isDbConnected={isDbConnected}
          isLocalDb={isLocalDb}
          isSyncingDrive={isSyncingDrive}
          isLoading={isLoading}
          hasSyncedBefore={hasSyncedBefore}
          onDriveSync={handleDriveSync}
          onFilesReady={startUpload}
        />
        <DriveSyncProgressCard isSyncing={isSyncingDrive} progress={syncProgress} onClose={resetDriveSync} />
        <IngestionProgressModal
          progress={uploadProgress}
          isActive={isUploading}
          onClose={resetUpload}
        />
        <Toaster position="top-right" />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-svh w-full overflow-hidden bg-background text-foreground font-sans antialiased">
          
          {/* Official ShadCN Sidebar */}
          <AppSidebar
            activeWorkspace={activeWorkspace}
            setActiveWorkspace={setActiveWorkspace}
            activeView={activeView}
            setActiveView={setActiveView}
            businessName={businessName}
            highAlertsCount={highAlertsCount}
            theme={theme}
            setTheme={setTheme}
            onOpenSecuritySettings={handleOpenSecuritySettings}
            onOpenHistoryRetention={() => setIsRetentionOpen(true)}
            onLogout={handleLogout}
            hasSales={!!salesData}
            hasDebitors={!!debitorsData}
            hasStock={!!godownStockData}
            hasCounterStock={!!counterStockData}
          />

          {/* Sidebar Main Content Inset Wrapper */}
          <SidebarInset className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <Header
              businessName={businessName}
              activeView={activeView}
              activeWorkspace={activeWorkspace}
              connectionMode={connectionMode}
              isSyncingDrive={isSyncingDrive}
              isUploading={isUploading}
              isLoading={isLoading}
              hasSyncedBefore={hasSyncedBefore}
              handleDriveSync={handleDriveSync}
              onFilesReady={startUpload}
            />

            {/* Main Content Area — sections with fixed-height panels manage scroll internally */}
            <main 
              ref={mainRef} 
              className={`flex-1 bg-background ${activeView === 'advisor' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
            >
              <div className={`max-w-6xl mx-auto w-full flex flex-col ${activeView === 'advisor' ? 'p-2.5 sm:p-4 flex-1 min-h-0 h-full' : 'p-4 sm:p-6 md:p-8'}`}>
                <Suspense fallback={
                  <div className="flex h-[calc(100svh-4rem)] w-full flex-col items-center justify-center gap-4 select-none">
                    <Loader2 className="size-9 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground font-semibold tracking-wide animate-pulse">Loading dashboard section…</p>
                  </div>
                }>
                  {activeView === 'portal' ? (
                    <PortalSection
                      salesData={salesData}
                      debitorsData={debitorsData}
                      stockData={godownStockData}
                      counterStockData={counterStockData}
                      onLaunchWorkspace={handleLaunchWorkspace}
                      cronSchedule={cronSchedule}
                      connectionMode={connectionMode}
                    />
                  ) : !activeSummary ? (
                    <EmptyWorkspaceState
                      activeWorkspace={activeWorkspace}
                      connectionMode={connectionMode}
                      onFilesReady={startUpload}
                    />
                  ) : isWorkspaceLoading ? (
                    <div className="flex h-[calc(100svh-10rem)] w-full flex-col items-center justify-center gap-4 select-none animate-in fade-in duration-200">
                      <Loader2 className="size-8 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground font-semibold tracking-wide animate-pulse">Retrieving full ledger database…</p>
                    </div>
                  ) : (
                    <>
                      {activeView === 'overview' && (
                        <OverviewSection summary={activeSummary} connectionMode={connectionMode} />
                      )}
                      {activeView === 'ledger' && (
                        <LedgerSection
                          summary={activeSummary}
                          activeTab={activeWorkspace}
                          relevantFileName={relevantFileName}
                        />
                      )}
                      {activeView === 'auditor' && (
                        <AuditorSection
                          alerts={activeAlerts}
                          totalTransactions={activeSummary.totalTransactions || 0}
                          relevantFileName={relevantFileName}
                          onRefreshData={() => fetchRealData(true)}
                        />
                      )}
                      {activeView === 'advisor' && (
                        <AdvisorSection key={activeSummary.fileName} summary={activeSummary} aiProvider={aiProvider} />
                      )}
                    </>
                  )}
                </Suspense>
              </div>
            </main>
          </SidebarInset>

        </div>
      </SidebarProvider>
      <SecuritySettingsModal 
        isOpen={isSecurityOpen} 
        onOpenChange={setIsSecurityOpen}
        defaultTab={securityModalInitialTab}
      />
      <HistoryRetentionModal
        isOpen={isRetentionOpen}
        onOpenChange={setIsRetentionOpen}
        activeWorkspace={activeWorkspace}
      />
      <DriveSyncProgressCard isSyncing={isSyncingDrive} progress={syncProgress} onClose={resetDriveSync} />
      <IngestionProgressModal
        progress={uploadProgress}
        isActive={isUploading}
        onClose={resetUpload}
      />
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

export default App;
