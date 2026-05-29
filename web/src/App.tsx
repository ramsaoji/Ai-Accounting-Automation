import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import {
  Cloud,
  Loader2,
  Users,
  RefreshCw
} from 'lucide-react';
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset
} from '@/components/ui/sidebar';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

import { useTheme } from '@/components/theme-provider';
import { useAccountingStore } from './store/useAccountingStore';
import { useAccountingData } from './hooks/useAccountingData';
import { UploadModal } from './components/UploadModal';
import { LockScreen } from './components/LockScreen';
import { Button } from '@/components/ui/button';
import { triggerDriveSync, fetchAccountingData, checkSessionStatus, logoutUser } from './services/api';
import { AppSidebar } from './components/AppSidebar';
import { OnboardingWizard } from './components/OnboardingWizard';
import { deriveBusinessName } from './utils/business';

// Lazy load layout sections and modals for bundle optimizations
const PortalSection = lazy(() => import('./components/PortalSection').then(m => ({ default: m.PortalSection })));
const OverviewSection = lazy(() => import('./components/OverviewSection').then(m => ({ default: m.OverviewSection })));
const LedgerSection = lazy(() => import('./components/LedgerSection').then(m => ({ default: m.LedgerSection })));
const AuditorSection = lazy(() => import('./components/AuditorSection').then(m => ({ default: m.AuditorSection })));
const AdvisorSection = lazy(() => import('./components/AdvisorSection').then(m => ({ default: m.AdvisorSection })));
const SecuritySettingsModal = lazy(() => import('./components/SecuritySettingsModal').then(m => ({ default: m.SecuritySettingsModal })));


export function App() {
  const { theme, setTheme } = useTheme();

  // Dynamically update document title from environment variable
  useEffect(() => {
    document.title = `${deriveBusinessName()} | Financial Command Center`;
  }, []);

  // Zustand Store selectors
  const appSessionToken = useAccountingStore((state) => state.appSessionToken);
  const activeWorkspace = useAccountingStore((state) => state.activeWorkspace);
  const activeView = useAccountingStore((state) => state.activeView);
  const setToken = useAccountingStore((state) => state.setToken);
  const clearToken = useAccountingStore((state) => state.clearToken);
  const setActiveWorkspace = useAccountingStore((state) => state.setActiveWorkspace);
  const setActiveView = useAccountingStore((state) => state.setActiveView);

  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up sync polling interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Scroll to top on activeView or activeWorkspace change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeView, activeWorkspace]);

  // Load real database data with modular 3-tier cascading fallback hook
  const { salesData, debitorsData, connectionMode, cronSchedule, isLoading, sync: fetchRealData } = useAccountingData();

  // Trigger sync on mount if already authenticated
  useEffect(() => {
    if (appSessionToken) {
      fetchRealData();
    }
  }, [appSessionToken, fetchRealData]);

  const businessName = useMemo(() => {
    return deriveBusinessName(salesData?.fileName ?? debitorsData?.fileName);
  }, [salesData?.fileName, debitorsData?.fileName]);

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
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setIsSyncingDrive(false);
            await fetchRealData(true); // silent refresh — no spinner, no duplicate toast
            toast.success('Google Drive sync completed! Dashboard updated.', { id: toastId });

          } else if (attempts >= maxAttempts) {
            // Edge case 3: Timeout — ingestion is taking too long
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setIsSyncingDrive(false);
            await fetchRealData(true); // silent refresh — show whatever is in DB now
            toast.info('Sync is still processing. Dashboard refreshed with latest available data.', { id: toastId });
          }
          // Otherwise: still waiting — no action, polling continues silently

        } catch {
          // Edge case 4: Polling network error
          if (attempts >= maxAttempts) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setIsSyncingDrive(false);
            // No fetchRealData here — last fetch already failed, avoid another bad request
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

  // Dynamic Rule Threshold Constants aligned with backend auditing policies
  const maxOutstandingDuesLimit = 15000;

  // activeSummary points to the currently active dataset
  const activeSummary = activeWorkspace === 'sales' ? salesData : debitorsData;

  // activeAlerts selects the alerts for the active workspace (centralized backend source of truth)
  const activeAlerts = useMemo(() => {
    if (activeWorkspace === 'sales') {
      return salesData?.alerts || [];
    } else {
      return debitorsData?.alerts || [];
    }
  }, [activeWorkspace, salesData, debitorsData]);

  // Launch workspace callback from portal
  const handleLaunchWorkspace = (workspace: 'sales' | 'debitors', view: 'overview' | 'ledger' | 'auditor' | 'advisor' = 'overview') => {
    setActiveWorkspace(workspace);
    setActiveView(view);
    toast.info(`Switched Workspace: ${workspace === 'sales' ? 'Sales Register' : 'Customer Debitors'}`);
  };

  // App Passcode Lock Screen verification check
  if (!appSessionToken) {
    return (
      <TooltipProvider>
        <LockScreen
          onUnlock={(token, remember) => {
            setToken(token, remember);
            fetchRealData();
          }}
        />
        <Toaster position="top-right" />
      </TooltipProvider>
    );
  }

  // Sync / loading screen placed after hook definitions to respect React Hook guidelines
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-background text-foreground font-sans antialiased flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium animate-pulse">Syncing accounting console…</p>
        </div>
      </div>
    );
  }

  // Global Onboarding View: if both datasets are empty on clean prod deployment
  if (!salesData && !debitorsData) {
    return (
      <TooltipProvider>
        <OnboardingWizard
          connectionMode={connectionMode}
          isSyncingDrive={isSyncingDrive}
          isLoading={isLoading}
          onDriveSync={handleDriveSync}
          onSuccess={fetchRealData}
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
            activeAlerts={activeAlerts}
            theme={theme}
            setTheme={setTheme}
            onOpenSecuritySettings={() => setIsSecurityOpen(true)}
            onLogout={handleLogout}
          />

          {/* Sidebar Main Content Inset Wrapper */}
          <SidebarInset className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Top Header Navbar */}
            <header className="h-16 border-b border-border/80 px-4 md:px-6 flex items-center justify-between bg-card select-none">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="hover:bg-muted size-9 sm:size-8 border bg-background cursor-pointer" />
                <div className="w-px h-4 bg-border shrink-0 self-center" aria-hidden="true" />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <span className="font-semibold text-foreground hidden sm:inline">{businessName}</span>
                  {activeView !== 'portal' && (
                    <>
                      <span className="hidden sm:inline">/</span>
                      <span className="capitalize font-semibold text-foreground hidden md:inline">
                        {activeWorkspace === 'sales' ? 'Sales Register' : 'Customer Debitors'}
                      </span>
                    </>
                  )}
                  {activeView !== 'portal' && <span className="hidden sm:inline">/</span>}
                  <span className="capitalize text-foreground font-semibold sm:font-normal">
                    {activeView === 'portal' ? 'All Ledgers' : activeView === 'overview' ? 'Overview' : activeView === 'ledger' ? 'Ledger' : activeView === 'auditor' ? 'Auditor Config' : 'AI Advisor'}
                  </span>
                </div>
              </div>

              {/* Header Actions Tray */}
              <div className="flex items-center gap-3">
                <UploadModal disabled={connectionMode !== 'live'} onSuccess={fetchRealData} />

                {connectionMode === 'live' && (
                  <Button
                    onClick={handleDriveSync}
                    disabled={isSyncingDrive || isLoading}
                    variant="outline"
                    size="sm"
                    className="gap-2 cursor-pointer border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
                  >
                    {isSyncingDrive ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Cloud className="size-4" />
                    )}
                    <span className="hidden sm:inline">Sync Drive</span>
                  </Button>
                )}

              </div>
            </header>

            {/* Main Content Area — sections with fixed-height panels manage scroll internally */}
            <main ref={mainRef} className="flex-1 overflow-y-auto bg-background">
              <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8 flex flex-col">
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
                      salesAlertCount={salesData?.alerts?.length || 0}
                      debitorsAlertCount={debitorsData?.alerts?.length || 0}
                      onLaunchWorkspace={handleLaunchWorkspace}
                      cronSchedule={cronSchedule}
                      connectionMode={connectionMode}
                    />
                  ) : !activeSummary ? (
                    <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-border/80 bg-muted/10 rounded-2xl gap-4 select-none my-6 animate-in fade-in duration-300">
                      <div className="size-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto">
                        <Users className="size-6" />
                      </div>
                      <div className="flex flex-col gap-1.5 max-w-sm">
                        <h3 className="text-sm font-bold text-foreground">
                          {activeWorkspace === 'sales' ? 'Daily Sales Register Required' : 'Outstanding Debitors Ledger Required'}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-normal">
                          {activeWorkspace === 'sales' 
                            ? 'Upload your Daily Sales Register spreadsheet to configure metrics, cash flow timelines, and compliance audits.'
                            : 'Upload your DEBITORS LIST spreadsheet to audit outstanding udhari, clearance percentages, and risk indexes.'
                          }
                        </p>
                      </div>
                      <div className="mt-2">
                        <UploadModal disabled={connectionMode !== 'live'} onSuccess={fetchRealData} />
                      </div>
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
                          maxOutstandingDuesLimit={maxOutstandingDuesLimit}
                        />
                      )}
                      {activeView === 'auditor' && (
                        <AuditorSection
                          alerts={activeAlerts}
                          totalTransactions={activeSummary.totalTransactions || 0}
                        />
                      )}
                      {activeView === 'advisor' && (
                        <AdvisorSection key={activeSummary.fileName} summary={activeSummary} />
                      )}
                    </>
                  )}
                </Suspense>
                </div>
            </main>
          </SidebarInset>

        </div>
      </SidebarProvider>
      <SecuritySettingsModal isOpen={isSecurityOpen} onOpenChange={setIsSecurityOpen} />
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

export default App;
