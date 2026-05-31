import {
  ChevronsUpDown,
  Check,
  BarChart3,
  Users,
  Grid,
  LayoutDashboard,
  Table,
  ShieldAlert,
  MessageSquare,
  Sun,
  Moon,
  LogOut,
  Settings
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';


export interface AppSidebarProps {
  activeWorkspace: 'sales' | 'debitors';
  setActiveWorkspace: (w: 'sales' | 'debitors') => void;
  activeView: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor';
  setActiveView: (v: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
  businessName: string;
  activeAlerts: unknown[];
  theme: 'dark' | 'light' | 'system';
  setTheme: (t: 'dark' | 'light' | 'system') => void;
  onOpenSecuritySettings: () => void;
  onLogout: () => void;
}

export function AppSidebar({
  activeWorkspace,
  setActiveWorkspace,
  activeView,
  setActiveView,
  businessName,
  activeAlerts,
  theme,
  setTheme,
  onOpenSecuritySettings,
  onLogout
}: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  const isDark = theme === 'system'
    ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === 'dark';

  const handleWorkspaceSelect = (workspace: 'sales' | 'debitors') => {
    setActiveWorkspace(workspace);
    if (activeView === 'portal') setActiveView('overview');
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleViewSelect = (view: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor') => {
    setActiveView(view);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleThemeToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
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
                  onClick={() => handleWorkspaceSelect('sales')}
                  className="flex items-center justify-between text-xs cursor-pointer py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="size-4 text-primary" />
                    <span className="font-medium">Daily Sales Register</span>
                  </div>
                  {activeWorkspace === 'sales' && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleWorkspaceSelect('debitors')}
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
                  onClick={() => handleViewSelect('portal')}
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
                  onClick={() => handleViewSelect('overview')}
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
                  onClick={() => handleViewSelect('ledger')}
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
                  onClick={() => handleViewSelect('auditor')}
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
                  onClick={() => handleViewSelect('advisor')}
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
              onClick={handleThemeToggle}
              className="text-xs font-semibold"
              tooltip={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-primary" />}
              <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onOpenSecuritySettings();
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              className="text-xs font-semibold"
              tooltip="Settings & Security"
            >
              <Settings className="size-4" />
              <span>Settings & Security</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogout}
              className="text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/5 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20 cursor-pointer"
              tooltip="Lock Application"
            >
              <LogOut className="size-4" />
              <span>Lock Application</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
