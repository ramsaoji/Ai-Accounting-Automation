import { useState, useMemo, useEffect } from 'react';
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
  HelpCircle,
  Grid,
  Wifi,
  WifiOff
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

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

import { useTheme } from '@/components/theme-provider';
import { mockSalesSummary, mockDebitorsSummary } from './mockData';
import { PortalSection } from './components/PortalSection';
import { OverviewSection } from './components/OverviewSection';
import { LedgerSection } from './components/LedgerSection';
import { AuditorSection } from './components/AuditorSection';
import { AdvisorSection } from './components/AdvisorSection';
import type { MasterSummary, Alert } from './types';

export function App() {
  const { theme, setTheme } = useTheme();

  // Active Workspace: 'sales' | 'debitors'
  const [activeWorkspace, setActiveWorkspace] = useState<'sales' | 'debitors'>('sales');
  
  // Active Navigation View: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor'
  const [activeView, setActiveView] = useState<'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor'>('portal');

  // Dynamic Rule Threshold States
  const [highExpenseLimit, setHighExpenseLimit] = useState(120000);
  const [suspiciousSpikeMultiplier, setSuspiciousSpikeMultiplier] = useState(3.5);
  const [maxOutstandingDuesLimit, setMaxOutstandingDuesLimit] = useState(15000);

  // Real Database States
  const [salesData, setSalesData] = useState<MasterSummary>(mockSalesSummary);
  const [debitorsData, setDebitorsData] = useState<MasterSummary>(mockDebitorsSummary);
  const [connectionMode, setConnectionMode] = useState<'live' | 'static' | 'mock'>('mock');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Real Data with 3-tier cascading fallback
  const fetchRealData = async () => {
    setIsLoading(true);
    
    // Tier 1: Try live API
    try {
      const salesRes = await fetch('http://localhost:8080/api/data/sales');
      const debitorsRes = await fetch('http://localhost:8080/api/data/debitors');

      if (salesRes.ok && debitorsRes.ok) {
        const parsedSales = await salesRes.json();
        const parsedDebitors = await debitorsRes.json();

        setSalesData({
          ...parsedSales,
          alerts: parsedSales.alerts ? parsedSales.alerts.map((a: any) => ({
            ruleId: a.ruleId,
            ruleName: a.ruleName,
            severity: a.severity,
            message: a.example || a.message
          })) : []
        });

        setDebitorsData({
          ...parsedDebitors,
          alerts: parsedDebitors.alerts ? parsedDebitors.alerts.map((a: any) => ({
            ruleId: a.ruleId,
            ruleName: a.ruleName,
            severity: a.severity,
            message: a.message
          })) : []
        });

        setConnectionMode('live');
        toast.success("Successfully synced live data from accounting server.");
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Backend API connection failed, trying static file fallback.', err);
    }

    // Tier 2: Try local static JSON files in public directory (Real static data)
    try {
      const salesStaticRes = await fetch('/data/sales-summary.json');
      const debitorsStaticRes = await fetch('/data/debitors-summary.json');

      if (salesStaticRes.ok && debitorsStaticRes.ok) {
        const parsedSales = await salesStaticRes.json();
        const parsedDebitors = await debitorsStaticRes.json();

        setSalesData({
          ...parsedSales,
          alerts: parsedSales.alerts ? parsedSales.alerts.map((a: any) => ({
            ruleId: a.ruleId,
            ruleName: a.ruleName,
            severity: a.severity,
            message: a.example || a.message
          })) : []
        });

        setDebitorsData({
          ...parsedDebitors,
          alerts: parsedDebitors.alerts ? parsedDebitors.alerts.map((a: any) => ({
            ruleId: a.ruleId,
            ruleName: a.ruleName,
            severity: a.severity,
            message: a.message
          })) : []
        });

        setConnectionMode('static');
        toast.success("Loaded offline static sync data (Hotel Gaurav Excel).");
        setIsLoading(false);
        return;
      }
    } catch (staticErr) {
      console.warn('Static files fetch failed, falling back to mock assets.', staticErr);
    }

    // Tier 3: Operation Simulation Mode with mockData
    setSalesData(mockSalesSummary);
    setDebitorsData(mockDebitorsSummary);
    setConnectionMode('mock');
    toast.warning("Accounting server offline. Operating in simulation mode.");
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRealData();
  }, []);

  // activeSummary points to the currently active dataset
  const activeSummary = useMemo(() => {
    return activeWorkspace === 'sales' ? salesData : debitorsData;
  }, [activeWorkspace, salesData, debitorsData]);

  // Baseline Monthly Expense average for anomaly calculations
  const averageMonthlyExpense = useMemo(() => {
    const months = salesData.months || [];
    if (months.length === 0) return 0;
    return months.reduce((sum, m) => sum + m.expenses, 0) / months.length;
  }, [salesData]);

  // Compute Alerts reactively based on active configuration
  const activeAlerts = useMemo(() => {
    const list: Alert[] = [];
    if (activeWorkspace === 'sales') {
      // Merge live input sliders + server-side alerts
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
  }, [activeWorkspace, salesData, debitorsData, highExpenseLimit, suspiciousSpikeMultiplier, maxOutstandingDuesLimit, averageMonthlyExpense]);

  // Launch workspace callback from portal
  const handleLaunchWorkspace = (workspace: 'sales' | 'debitors') => {
    setActiveWorkspace(workspace);
    setActiveView('overview');
    toast.info(`Switched Workspace: ${workspace === 'sales' ? 'Sales Register' : 'Customer Debitors'}`);
  };

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
                          <span className="text-xs font-bold leading-none">Hotel Gaurav</span>
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
              <div className="text-center w-full px-2 py-1 bg-muted/30 border rounded-md mt-1 group-data-[collapsible=icon]:hidden select-none">
                <span className="text-[0.62rem] font-bold text-muted-foreground block uppercase tracking-wider">
                  Auditor Console
                </span>
                <span className="text-[0.6rem] text-muted-foreground/80 block mt-0.5 font-medium">
                  v1.2.0 • Stable Release
                </span>
              </div>
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
                  <span className="font-semibold text-foreground">Hotel Gaurav</span>
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
                {/* Live Status indicator */}
                <div className={`flex items-center gap-1.5 text-[0.68rem] font-bold border rounded-full px-2.5 py-1 select-none transition-all ${
                  connectionMode === 'live' 
                    ? 'bg-success/10 text-success border-success/25' 
                    : connectionMode === 'static'
                      ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 border-indigo-500/25'
                      : 'bg-warning/10 text-warning border-warning/25'
                }`}>
                  {connectionMode === 'live' ? (
                    <>
                      <span className="relative flex size-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full size-2 bg-success"></span>
                      </span>
                      <Wifi className="size-3 ml-1" />
                      <span>Live Sync (Active)</span>
                    </>
                  ) : connectionMode === 'static' ? (
                    <>
                      <span className="relative flex size-2 shrink-0">
                        <span className="relative inline-flex rounded-full size-2 bg-indigo-500"></span>
                      </span>
                      <Wifi className="size-3 ml-1" />
                      <span>Static Sync (Real Offline)</span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex size-2 shrink-0">
                        <span className="relative inline-flex rounded-full size-2 bg-warning"></span>
                      </span>
                      <WifiOff className="size-3 ml-1" />
                      <span>Simulation Mode</span>
                    </>
                  )}
                </div>

                <button
                  onClick={fetchRealData}
                  disabled={isLoading}
                  className="size-8 rounded-lg border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:outline-none disabled:opacity-50"
                  title="Sync real data from backend"
                >
                  <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <span title="Auditor center help manual">
                  <HelpCircle className="size-4 text-muted-foreground/75 cursor-help hover:text-foreground transition-colors shrink-0" />
                </span>
              </div>
            </header>

            {/* Main Content Area — sections with fixed-height panels manage scroll internally */}
            <main className="flex-1 overflow-hidden bg-background">
              <div className="h-full overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full p-6 md:p-8">
                  {activeView === 'portal' && (
                    <PortalSection
                      salesAlertCount={salesData.alerts.length}
                      debitorsAlertCount={debitorsData.alerts.length}
                      onLaunchWorkspace={handleLaunchWorkspace}
                    />
                  )}
                  {activeView === 'overview' && (
                    <OverviewSection summary={activeSummary} />
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
                      highExpenseLimit={highExpenseLimit}
                      setHighExpenseLimit={setHighExpenseLimit}
                      suspiciousSpikeMultiplier={suspiciousSpikeMultiplier}
                      setSuspiciousSpikeMultiplier={setSuspiciousSpikeMultiplier}
                      maxOutstandingDuesLimit={maxOutstandingDuesLimit}
                      setMaxOutstandingDuesLimit={setMaxOutstandingDuesLimit}
                      alerts={activeAlerts}
                      totalTransactions={activeSummary.totalTransactions || 0}
                    />
                  )}
                  {activeView === 'advisor' && (
                    <AdvisorSection summary={activeSummary} />
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
