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

  // Scroll to top on activeView or activeWorkspace change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeView, activeWorkspace]);

  // Load real database data with modular 3-tier cascading fallback hook
  const { salesData, debitorsData, connectionMode, isDbConnected, isLocalDb, hasSyncedBefore, cronSchedule, isLoading, aiProvider, sync: fetchRealData } = useAccountingData();

  // Custom Drive Sync hook to isolate background polling/interval logic
  const { isSyncingDrive, syncProgress, handleDriveSync, resetDriveSync } = useDriveSync({
    salesData,
    debitorsData,
    connectionMode,
    fetchRealData
  });

  // Manual upload hook — owns upload logic and progress state
  const { isUploading, uploadProgress, startUpload, resetUpload } = useManualUpload({
    onSuccess: fetchRealData,
  });

  // Trigger sync on mount if already authenticated
  useEffect(() => {
    if (appSessionToken) {
      fetchRealData();
    }
  }, [appSessionToken, fetchRealData]);

  const businessName = useMemo(() => {
    return deriveBusinessName(salesData?.fileName ?? debitorsData?.fileName);
  }, [salesData?.fileName, debitorsData?.fileName]);

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
    return <LoadingScreen />;
  }

  // Global Onboarding View: if both datasets are empty on clean prod deployment
  if (!salesData && !debitorsData) {
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
            activeAlerts={activeAlerts}
            theme={theme}
            setTheme={setTheme}
            onOpenSecuritySettings={() => setIsSecurityOpen(true)}
            onLogout={handleLogout}
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
                    <EmptyWorkspaceState
                      activeWorkspace={activeWorkspace}
                      connectionMode={connectionMode}
                      onFilesReady={startUpload}
                    />
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
      <SecuritySettingsModal isOpen={isSecurityOpen} onOpenChange={setIsSecurityOpen} />
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
