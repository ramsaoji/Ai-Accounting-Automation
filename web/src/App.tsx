import { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Table,
  ShieldAlert,
  MessageSquare,
  ChevronsUpDown,
  Check,
  BarChart3,
  Users,
  Sun,
  Moon,
  RefreshCw,
  Grid,
  Cloud,
  Loader2
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

import { useTheme } from '@/components/theme-provider';
import { useAccountingData } from './hooks/useAccountingData';
import { PortalSection } from './components/PortalSection';
import { OverviewSection } from './components/OverviewSection';
import { LedgerSection } from './components/LedgerSection';
import { AuditorSection } from './components/AuditorSection';
import { AdvisorSection } from './components/AdvisorSection';
import { UploadModal } from './components/UploadModal';
import { Button } from '@/components/ui/button';
import { triggerDriveSync, fetchAccountingData } from './services/api';
import type { Alert } from './types';

export function App() {
  const { theme, setTheme } = useTheme();

  // Active Workspace: 'sales' | 'debitors'
  const [activeWorkspace, setActiveWorkspace] = useState<'sales' | 'debitors'>('sales');
  
  // Active Navigation View: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor'
  const [activeView, setActiveView] = useState<'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor'>('portal');

  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // Load real database data with modular 3-tier cascading fallback hook
  const { salesData, debitorsData, connectionMode, cronSchedule, isLoading, sync: fetchRealData } = useAccountingData();

  const businessName = useMemo(() => {
    const files = [salesData?.fileName, debitorsData?.fileName].filter(Boolean) as string[];
    for (const f of files) {
      const lower = f.toLowerCase();
      if (lower.includes('gaurav')) return 'Hotel Gaurav';
      
      let name = f.replace(/\.[^/.]+$/, "");
      name = name.replace(/(daily\s*sales\s*register|debitors\s*list|debitors|sales|ledger|list)/gi, '').trim();
      name = name.replace(/[_\-]+/g, ' ').trim();
      if (name.length > 2) {
        return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return 'Hotel Gaurav'; // default fallback
  }, [salesData, debitorsData]);

  const handleDriveSync = async () => {
    if (isSyncingDrive) return;
    setIsSyncingDrive(true);
    const toastId = toast.loading('Initiating Google Drive sync...');

    try {
      const initialSalesTime = salesData?.runTimestamp;
      const initialDebitorsTime = debitorsData?.runTimestamp;

      const result = await triggerDriveSync();
      
      if (result.status === 'up-to-date') {
        setIsSyncingDrive(false);
        toast.success('Google Drive is already up-to-date!', { id: toastId });
        return;
      }

      toast.loading('Google Drive sync requested. Ingesting worksheets...', { id: toastId });

      let attempts = 0;
      const maxAttempts = 12; // 30 seconds max
      const interval = setInterval(async () => {
        attempts++;
        try {
          const syncResult = await fetchAccountingData();
          const newSalesTime = syncResult.sales?.runTimestamp;
          const newDebitorsTime = syncResult.debitors?.runTimestamp;

          const salesUpdated = !!(newSalesTime && newSalesTime !== initialSalesTime);
          const debitorsUpdated = !!(newDebitorsTime && newDebitorsTime !== initialDebitorsTime);
          const emptyGotData = !(salesData || debitorsData) && !!(syncResult.sales || syncResult.debitors);

          if (salesUpdated || debitorsUpdated || emptyGotData) {
            clearInterval(interval);
            setIsSyncingDrive(false);
            await fetchRealData();
            toast.success('Google Drive sync completed successfully!', { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsSyncingDrive(false);
            await fetchRealData();
            toast.info('Sync request completed. Refreshing dashboard...', { id: toastId });
          }
        } catch (pollErr) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsSyncingDrive(false);
            toast.error('Sync polling timed out. Check backend logs.', { id: toastId });
          }
        }
      }, 2500);
    } catch (err: any) {
      setIsSyncingDrive(false);
      toast.error(`Drive sync failed: ${err.message || err}`, { id: toastId });
    }
  };

  // Dynamic Rule Threshold Constants aligned with backend auditing policies
  const highExpenseLimit = 50000;
  const suspiciousSpikeMultiplier = 3.0;
  const maxOutstandingDuesLimit = 15000;

  // activeSummary points to the currently active dataset
  const activeSummary = useMemo(() => {
    return activeWorkspace === 'sales' ? salesData : debitorsData;
  }, [activeWorkspace, salesData, debitorsData]);

  // Baseline Monthly Expense average for anomaly calculations
  const averageMonthlyExpense = useMemo(() => {
    if (!salesData) return 0;
    const months = salesData.months || [];
    if (months.length === 0) return 0;
    return months.reduce((sum, m) => sum + m.expenses, 0) / months.length;
  }, [salesData]);

  // Compute Alerts reactively based on active configuration
  const activeAlerts = useMemo(() => {
    const list: Alert[] = [];
    if (activeWorkspace === 'sales') {
      if (!salesData) return [];
      const baseAlerts = salesData.alerts || [];
      list.push(...baseAlerts);

      // Add slider reactive breaches
      const months = salesData.months || [];
      months.forEach((m) => {
        if (m.expenses > highExpenseLimit) {
          list.push({
            ruleId: 'RULE-01',
            ruleName: 'High Expense Limit Breach',
            severity: 'high',
            message: `Sheet "${m.sheetName}" logged ₹${m.expenses.toLocaleString('en-IN')} in expenses, exceeding the safety ceiling of ₹${highExpenseLimit.toLocaleString('en-IN')}.`,
          });
        }
        if (m.expenses > averageMonthlyExpense * suspiciousSpikeMultiplier) {
          list.push({
            ruleId: 'RULE-02',
            ruleName: 'Suspicious Expense Spike',
            severity: 'critical',
            message: `Expenses in "${m.sheetName}" (₹${m.expenses.toLocaleString('en-IN')}) are ${(m.expenses / averageMonthlyExpense).toFixed(1)}x higher than the baseline average monthly expense of ₹${Math.round(averageMonthlyExpense).toLocaleString('en-IN')}.`,
          });
        }
      });
    } else {
      // Debitors workspace
      if (!debitorsData) return [];
      const baseAlerts = debitorsData.alerts || [];
      list.push(...baseAlerts);

      const topDebitors = debitorsData.topDebitors || [];
      topDebitors.forEach((debtor) => {
        if (debtor.pending > maxOutstandingDuesLimit) {
          list.push({
            ruleId: 'RULE-03',
            ruleName: 'Debitor Cap Exceeded',
            severity: 'critical',
            message: `Customer "${debtor.name}" carries ₹${debtor.pending.toLocaleString('en-IN')} in outstanding pending dues, breaching the credit cap of ₹${maxOutstandingDuesLimit.toLocaleString('en-IN')}.`,
          });
        }
      });
    }
    return list;
  }, [activeWorkspace, salesData, debitorsData, averageMonthlyExpense]);

  // Launch workspace callback from portal
  const handleLaunchWorkspace = (workspace: 'sales' | 'debitors') => {
    setActiveWorkspace(workspace);
    setActiveView('overview');
    toast.info(`Switched Workspace: ${workspace === 'sales' ? 'Sales Register' : 'Customer Debitors'}`);
  };

  // Sync / loading screen placed after hook definitions to respect React Hook guidelines
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-background text-foreground font-sans antialiased flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium animate-pulse">Syncing accounting console...</p>
        </div>
      </div>
    );
  }

  // Global Onboarding View: if both datasets are empty on clean prod deployment
  if (!salesData && !debitorsData) {
    return (
      <TooltipProvider>
        <div className="flex h-screen w-screen bg-background text-foreground font-sans antialiased flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
          <div className="max-w-md w-full flex flex-col gap-6 text-center">
            <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto shadow-xs">
              <LayoutDashboard className="size-8" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-bold font-heading tracking-tight text-foreground">
                AI Accounting Automation Console
              </h1>
              <p className="text-xs text-muted-foreground leading-normal max-w-sm mx-auto">
                No accounting records found in the database. Ingest daily sales registers or customer outstanding debit ledgers to initialize your compliance command center.
              </p>
            </div>
            
            <div className="border border-border/80 rounded-xl p-5 bg-muted/5 flex flex-col gap-3.5 text-left text-xs">
              <h3 className="font-bold flex items-center gap-2">
                🛡️ Supported Ingestion Formats
              </h3>
              <ul className="flex flex-col gap-2 text-muted-foreground font-medium list-disc list-inside font-sans">
                <li><strong>Daily Sales Registers</strong> (Liquor split, cash flow, operational expenditures)</li>
                <li><strong>Debitors Outstanding List</strong> (Udhari credit balances, aging indices, collection risks)</li>
              </ul>
            </div>
            
            <div className="flex items-center justify-center gap-3 mt-2">
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
                  <span>Sync Drive</span>
                </Button>
              )}
            </div>
          </div>
          <Toaster position="top-right" />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans antialiased">
          
          {/* Official ShadCN Sidebar */}
          <Sidebar collapsible="icon" className="border-r border-border/80">
            {/* Header Workspace Switcher */}
            <SidebarHeader className="h-16 border-b border-border/80 px-4 group-data-[collapsible=icon]:px-2 flex flex-row items-center group-data-[collapsible=icon]:justify-center">
              <SidebarMenu className="w-full">
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="peer/menu-button group/menu-button flex w-full items-center justify-between gap-2 overflow-hidden rounded-md p-2 text-start text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:opacity-50 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-12 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! select-none cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                          {activeWorkspace === 'sales' ? 'SG' : 'DL'}
                        </div>
                        <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                          <span className="text-xs font-bold leading-none">{businessName}</span>
                          <span className="text-[0.68rem] text-muted-foreground mt-1 leading-none">
                            {activeWorkspace === 'sales' ? 'Daily Sales Register' : 'Customer Debitors'}
                          </span>
                        </div>
                      </div>
                      <ChevronsUpDown className="size-4 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 mt-1">
                      <DropdownMenuLabel className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">
                        Select Ledger Register
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem
                        onClick={() => {
                          setActiveWorkspace('sales');
                          if (activeView === 'portal') setActiveView('overview');
                          toast.info("Switched to Daily Sales Register");
                        }}
                        className="flex items-center justify-between text-xs cursor-pointer py-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <BarChart3 className="size-4 text-primary" />
                          <span className="font-medium">Daily Sales Register</span>
                        </div>
                        {activeWorkspace === 'sales' && <Check className="size-3.5 text-primary" />}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          setActiveWorkspace('debitors');
                          if (activeView === 'portal') setActiveView('overview');
                          toast.info("Switched to Debitors Outstanding Ledger");
                        }}
                        className="flex items-center justify-between text-xs cursor-pointer py-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="size-4 text-primary" />
                          <span className="font-medium">Debitors Outstanding Ledger</span>
                        </div>
                        {activeWorkspace === 'debitors' && <Check className="size-3.5 text-primary" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>

            {/* Sidebar Main Content Navigation Items */}
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="px-2 text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
                  Console Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="gap-1">
                    {/* All Ledgers Console Directory */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={activeView === 'portal'}
                        onClick={() => setActiveView('portal')}
                        className="text-xs font-semibold"
                        tooltip="All Ledgers Portal"
                      >
                        <Grid className="size-4" />
                        <span>All Ledgers Directory</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Overview Nav Button */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={activeView === 'overview'}
                        onClick={() => setActiveView('overview')}
                        className="text-xs font-semibold"
                        tooltip="Executive Overview"
                      >
                        <LayoutDashboard className="size-4" />
                        <span>Executive Overview</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Ledger Records Nav Button */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={activeView === 'ledger'}
                        onClick={() => setActiveView('ledger')}
                        className="text-xs font-semibold"
                        tooltip="Ledger Directory"
                      >
                        <Table className="size-4" />
                        <span>Ledger Directory</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Rules & Alerts Nav Button */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={activeView === 'auditor'}
                        onClick={() => setActiveView('auditor')}
                        className="text-xs font-semibold"
                        tooltip="Rules & Alerts"
                      >
                        <ShieldAlert className="size-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">Rules & Alerts</span>
                        {activeAlerts.length > 0 && (
                          <span className="ml-auto text-[0.62rem] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 leading-none group-data-[collapsible=icon]:hidden">
                            {activeAlerts.length}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* AI Advisor Chat Nav Button */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={activeView === 'advisor'}
                        onClick={() => setActiveView('advisor')}
                        className="text-xs font-semibold"
                        tooltip="AI Strategic Chat"
                      >
                        <MessageSquare className="size-4" />
                        <span>AI Strategic Chat</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            {/* Sidebar Footer Console Controls */}
            <SidebarFooter className="border-t border-border/80 p-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="text-xs font-semibold"
                    tooltip={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                  >
                    {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-primary" />}
                    <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              {/* <div className="text-center w-full px-2 py-1 bg-muted/30 border rounded-md mt-1 group-data-[collapsible=icon]:hidden select-none">
                <span className="text-[0.62rem] font-bold text-muted-foreground block uppercase tracking-wider">
                  Auditor Console
                </span>
                <span className="text-[0.6rem] text-muted-foreground/80 block mt-0.5 font-medium">
                  v1.2.0 • Stable Release
                </span>
              </div> */}
            </SidebarFooter>
          </Sidebar>

          {/* Sidebar Main Content Inset Wrapper */}
          <SidebarInset className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Top Header Navbar */}
            <header className="h-16 border-b border-border/80 px-6 flex items-center justify-between bg-card select-none">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="hover:bg-muted size-8 border bg-background" />
                <div className="w-px h-4 bg-border shrink-0 self-center" aria-hidden="true" />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <span className="font-semibold text-foreground">{businessName}</span>
                  {activeView !== 'portal' && (
                    <>
                      <span>/</span>
                      <span className="capitalize font-semibold text-foreground">
                        {activeWorkspace === 'sales' ? 'Sales Register' : 'Customer Debitors'}
                      </span>
                    </>
                  )}
                  <span>/</span>
                  <span className="capitalize">
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
                    <span>Sync Drive</span>
                  </Button>
                )}

              </div>
            </header>

            {/* Main Content Area — sections with fixed-height panels manage scroll internally */}
            <main className="flex-1 overflow-hidden bg-background">
              <div className="h-full overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full p-6 md:p-8">
                  {activeView === 'portal' ? (
                    <PortalSection
                      salesData={salesData}
                      debitorsData={debitorsData}
                      salesAlertCount={salesData ? salesData.alerts.length : 0}
                      debitorsAlertCount={debitorsData ? debitorsData.alerts.length : 0}
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
                        <AdvisorSection summary={activeSummary} />
                      )}
                    </>
                  )}
                </div>
              </div>
            </main>
          </SidebarInset>

        </div>
      </SidebarProvider>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

export default App;
