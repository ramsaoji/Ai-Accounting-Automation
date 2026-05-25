import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { Alert } from '../types';
import {
  Sliders,
  Sparkles,
  Ban,
  AlertTriangle,
  Flame,
  AlertCircle,
  AlertOctagon,
  Info,
  CheckCircle,
  Search,
  CheckSquare,
  ShieldCheck,
  FileText,
  FileWarning,
  ExternalLink,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AuditorSectionProps {
  alerts: Alert[];
  totalTransactions: number;
}

export const AuditorSection: React.FC<AuditorSectionProps> = ({
  alerts,
  totalTransactions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<string[]>([]);
  
  // Left sidebar tab: 'feed' | 'policies'
  const [activeLeftTab, setActiveLeftTab] = useState<'feed' | 'policies'>('feed');

  // Currently selected alert in Sentry split-pane view
  const [selectedAlertIndex, setSelectedAlertIndex] = useState<number | null>(0);

  // Dual-Authorization Secondary Signature states
  const [activeActionModal, setActiveActionModal] = useState<Alert | null>(null);
  const [passcode, setPasscode] = useState('');
  const [primarySigner, setPrimarySigner] = useState('Senior Bookkeeper');
  const [secondarySigner, setSecondarySigner] = useState('General Manager');

  const handleAuthorizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      toast.error('Please enter a valid secondary authorization PIN.');
      return;
    }
    
    if (activeActionModal) {
      if (!acknowledgedAlerts.includes(activeActionModal.message)) {
        setAcknowledgedAlerts(prev => [...prev, activeActionModal.message]);
      }
      toast.success(`Dual-Authorization Approved! Bill signed off by ${secondarySigner} and marked as Resolved.`);
      setActiveActionModal(null);
    }
  };

  // Group counts for active dataset
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  const severityCounts = {
    all: alerts.length,
    critical: criticalCount,
    high: highCount,
    medium: mediumCount,
    low: lowCount
  };

  // Filter alerts by search term and selected severity filter
  const filteredAlerts = useMemo(() => {
    let result = alerts;

    if (severityFilter !== 'all') {
      result = result.filter(a => a.severity === severityFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.ruleName.toLowerCase().includes(q) || 
        a.message.toLowerCase().includes(q)
      );
    }

    return result;
  }, [alerts, severityFilter, searchTerm]);

  // Performance slice to avoid lagging DOM for 19k alerts
  const displayAlerts = useMemo(() => {
    return filteredAlerts.slice(0, 50);
  }, [filteredAlerts]);

  // Dynamic selection adjustment
  const activeSelectedAlert = useMemo(() => {
    if (displayAlerts.length === 0) return null;
    if (selectedAlertIndex === null || selectedAlertIndex >= displayAlerts.length) {
      return displayAlerts[0];
    }
    return displayAlerts[selectedAlertIndex];
  }, [displayAlerts, selectedAlertIndex]);

  const toggleAcknowledge = (alertMsg: string) => {
    const isAck = acknowledgedAlerts.includes(alertMsg);
    setAcknowledgedAlerts(prev =>
      prev.includes(alertMsg)
        ? prev.filter(msg => msg !== alertMsg)
        : [...prev, alertMsg]
    );
    if (isAck) {
      toast.info("Exception marked as unresolved.");
    } else {
      toast.success("Exception successfully resolved.");
    }
  };

  const getSeverityMeta = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          icon: <AlertOctagon className="size-4 text-destructive" />,
          dot: 'bg-destructive',
          badge: 'bg-destructive/10 text-destructive border-destructive/20',
          text: 'text-destructive',
          border: 'border-l-destructive',
          action: 'Audit ledger balances immediately to correct double-billing or negative balance offsets.',
          priority: 'P1 - High Threat',
          logic: 'Breaches structural bounds or credit limits established by ledger governance policies.'
        };
      case 'high':
        return {
          icon: <Flame className="size-4 text-warning" />,
          dot: 'bg-warning',
          badge: 'bg-warning/10 text-warning border-warning/20',
          text: 'text-warning',
          border: 'border-l-warning',
          action: 'Cross-reference supplier invoice statements to negotiate weekly installment structures.',
          priority: 'P2 - High Margin Spikes',
          logic: 'Exceeds maximum allowable category spend deviations, flag for operational overhead leak.'
        };
      case 'medium':
        return {
          icon: <AlertCircle className="size-4 text-warning" />,
          dot: 'bg-warning',
          badge: 'bg-warning/10 text-warning border-warning/20',
          text: 'text-warning',
          border: 'border-l-warning',
          action: 'Analyze high spikes in category spend and require secondary signatures on bills.',
          priority: 'P3 - Moderate Deviation',
          logic: 'Calculates high category outflow relative to seasonal moving base limits.'
        };
      default:
        return {
          icon: <Info className="size-4 text-info" />,
          dot: 'bg-info',
          badge: 'bg-info/10 text-info border-info/20',
          text: 'text-info',
          border: 'border-l-info',
          action: 'Monitor off-hours posting times to prevent delay lags or entry integrity errors.',
          priority: 'P4 - Operational Info',
          logic: 'Logs delayed transactions posted on weekends or after standard banking closures.'
        };
    }
  };

  const exceptionRatio = totalTransactions > 0 
    ? ((alerts.length / totalTransactions) * 100).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      {/* Title */}
      <div className="border-b pb-5">
        <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
          Audit Anomaly Board
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time security and compliance issues scanned from accounting spreadsheets.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
        <Card className="shadow-xs border bg-card/45">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Audited Transactions</span>
              <span className="text-lg font-extrabold font-mono text-foreground mt-0.5">
                {totalTransactions.toLocaleString()}
              </span>
            </div>
            <div className="size-8 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground">
              <FileText className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card/45">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Active Exceptions</span>
              <span className="text-lg font-extrabold font-mono text-foreground mt-0.5">
                {alerts.length.toLocaleString()}
              </span>
            </div>
            <div className="size-8 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center">
              <AlertTriangle className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card/45">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Audit Compliance Index</span>
              <span className="text-lg font-extrabold font-mono mt-0.5 text-foreground">
                {criticalCount > 0 ? `${(100 - parseFloat(exceptionRatio)).toFixed(1)}%` : '100%'}
              </span>
            </div>
            <div className={`size-8 rounded-lg border flex items-center justify-center ${
              criticalCount > 0 ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-success/10 border-success/20 text-success'
            }`}>
              {criticalCount > 0 ? <AlertTriangle className="size-4" /> : <ShieldCheck className="size-4" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Datadog / Sentry Split-pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-1 items-start" style={{ height: 'calc(100vh - 13rem)' }}>
        
        {/* Left Column Pane (2/5 size) */}
        <div className="lg:col-span-2 flex flex-col border rounded-xl overflow-hidden bg-card/50 h-full min-h-0">
          {/* Tab Selector Header */}
          <div className="flex border-b bg-muted/20 select-none">
            <button
              onClick={() => setActiveLeftTab('feed')}
              className={`flex-1 text-xs py-3 font-bold border-r transition-all cursor-pointer ${
                activeLeftTab === 'feed'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-muted/10'
              }`}
            >
              Exceptions Feed ({filteredAlerts.length})
            </button>
            <button
              onClick={() => setActiveLeftTab('policies')}
              className={`flex-1 text-xs py-3 font-bold transition-all cursor-pointer ${
                activeLeftTab === 'policies'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-muted/10'
              }`}
            >
              Auditor Policies
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col overflow-hidden">
            {activeLeftTab === 'feed' ? (
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                {/* Search / Filters toolbar */}
                <div className="flex flex-col gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search exception trace..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  {/* Severity Pill Buttons */}
                  <div className="flex flex-wrap gap-1">
                    {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                      <button
                        key={sev}
                        onClick={() => {
                          setSeverityFilter(sev);
                          setSelectedAlertIndex(0);
                        }}
                        className={`text-[0.65rem] px-2 py-1 rounded border font-semibold capitalize transition-all cursor-pointer ${
                          severityFilter === sev
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {sev} ({severityCounts[sev]})
                      </button>
                    ))}
                  </div>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 mt-2">
                  {displayAlerts.length === 0 ? (
                    <div className="text-center py-16 text-xs text-muted-foreground font-medium">
                      No issues matched search query.
                    </div>
                  ) : (
                    displayAlerts.map((anomaly, idx) => {
                      const isSelected = activeSelectedAlert?.message === anomaly.message;
                      const isAck = acknowledgedAlerts.includes(anomaly.message);
                      const meta = getSeverityMeta(anomaly.severity);

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedAlertIndex(idx)}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 border-l-4 select-none relative ${meta.border} ${
                            isSelected
                              ? 'bg-muted border-r-foreground/20'
                              : 'bg-background hover:bg-muted/40'
                          } ${isAck ? 'opacity-50 line-through' : ''}`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[0.72rem] font-bold text-foreground truncate max-w-[150px]">
                              {anomaly.ruleName}
                            </span>
                            <span className={`text-[0.58rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 ${meta.badge}`}>
                              {React.cloneElement(meta.icon, { className: "size-2.5" })}
                              {anomaly.severity}
                            </span>
                          </div>
                          <p className="text-[0.68rem] text-muted-foreground mt-1 truncate max-w-[240px]">
                            {anomaly.message}
                          </p>
                          {isAck && (
                            <span className="absolute right-2 bottom-1.5 text-[0.6rem] font-bold text-success flex items-center gap-1">
                              <CheckCircle className="size-3" /> Resolved
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                  {filteredAlerts.length > 50 && (
                    <span className="text-[0.62rem] text-center text-muted-foreground/80 font-mono mt-1 select-none">
                      +{(filteredAlerts.length - 50).toLocaleString()} more alerts hidden. Filter to refine.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              // Tab 2: Policy Configurator (Static Rules Display)
              <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-1">
                <div className="flex flex-col gap-1 select-none">
                  <h4 className="text-xs font-bold text-foreground">Active Auditing Policies</h4>
                  <p className="text-[0.7rem] text-muted-foreground leading-normal">
                    These rules are enforced deterministically by the backend accounting worker during daily batch execution.
                  </p>
                </div>

                {/* Policy 1 */}
                <div className="flex flex-col gap-2 p-3 border rounded-xl bg-background/50">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-primary" />
                      High Outflow Ceiling
                    </span>
                    <span className="font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-[0.65rem]">
                      ₹50,000
                    </span>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground leading-normal mt-1">
                    Flags individual supplier invoices, bills, or operational expense logs exceeding ₹50,000.
                  </p>
                </div>

                {/* Policy 2 */}
                <div className="flex flex-col gap-2 p-3 border rounded-xl bg-background/50">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-amber-500" />
                      Category Spike Threshold
                    </span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[0.65rem]">
                      3.0x Average
                    </span>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground leading-normal mt-1">
                    Triggers when a category debit exceeds 3x the historical monthly average for that operational account.
                  </p>
                </div>

                {/* Policy 3 */}
                <div className="flex flex-col gap-2 p-3 border rounded-xl bg-background/50">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Ban className="size-3.5 text-destructive" />
                      Outstanding Credit Cap
                    </span>
                    <span className="font-mono text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded text-[0.65rem]">
                      ₹15,000
                    </span>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground leading-normal mt-1">
                    Flags customer debit accounts in the Debitor Outstanding list carrying pending balances over ₹15,000.
                  </p>
                </div>

                {/* Policy 4 */}
                <div className="flex flex-col gap-2 p-3 border rounded-xl bg-background/50">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Info className="size-3.5 text-info" />
                      Off-Hours Banking Window
                    </span>
                    <span className="font-mono text-info bg-info/10 border border-info/20 px-2 py-0.5 rounded text-[0.65rem]">
                      11 PM - 5 AM (IST)
                    </span>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground leading-normal mt-1">
                    Audits booking lag times, flagging journal ledger entries finalized during late-nights or weekends.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column Pane Inspector (3/5 size) */}
        <Card className="lg:col-span-3 border bg-card/45 h-full min-h-0 overflow-hidden flex flex-col justify-between">
          {!activeSelectedAlert ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <FileWarning className="size-10 text-muted-foreground/60 mb-3" />
              <h3 className="text-xs font-bold text-foreground">No Selected Anomaly</h3>
              <p className="text-[0.7rem] text-muted-foreground max-w-xs mt-1.5 leading-normal">
                Click on any exception entry in the left feed to launch the transaction debugger and audit stack trace.
              </p>
            </div>
          ) : (
            // Issue Selected View
            <>
              {/* Header Details */}
              <div className="p-6 border-b border-border/80 flex flex-col gap-3 select-none">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                    ID: {activeSelectedAlert.ruleId || 'ANOMALY_TRACE'}
                  </span>
                  <span className="text-[0.62rem] text-muted-foreground flex items-center gap-1 font-semibold">
                    Class: Spreadsheet Integrity
                    <ExternalLink className="size-3" />
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                  <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    {getSeverityMeta(activeSelectedAlert.severity).icon}
                    {activeSelectedAlert.ruleName}
                  </h3>
                  <span className={`text-[0.62rem] font-bold px-2 py-1 rounded border uppercase tracking-wider self-start sm:self-auto flex items-center gap-1.5 ${
                    getSeverityMeta(activeSelectedAlert.severity).badge
                  }`}>
                    {React.cloneElement(getSeverityMeta(activeSelectedAlert.severity).icon, { className: "size-3" })}
                    {activeSelectedAlert.severity} Severity
                  </span>
                </div>
              </div>

              {/* Inspector Content Panel */}
              <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
                {/* Rule Message Box */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    Trigger Message
                  </span>
                  <div className="text-xs font-medium leading-relaxed bg-muted/40 p-4 border rounded-xl text-foreground font-mono">
                    {activeSelectedAlert.message}
                  </div>
                </div>


                {/* Recommendations */}
                <div className="flex flex-col gap-1.5 border-t pt-4">
                  <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    Rule Logic & Action Plan
                  </span>
                  <div className="text-xs leading-relaxed font-semibold text-foreground flex flex-col gap-1">
                    <p className="text-muted-foreground text-[0.7rem] leading-relaxed font-medium">
                      {getSeverityMeta(activeSelectedAlert.severity).logic}
                    </p>
                    <button
                      onClick={() => {
                        setActiveActionModal(activeSelectedAlert);
                        setPasscode('');
                      }}
                      className="mt-2.5 flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-left font-bold cursor-pointer group focus:outline-none select-none"
                    >
                      <ChevronRight className="size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      <span className="underline underline-offset-4 decoration-primary/30 group-hover:decoration-primary/80 transition-colors">
                        {getSeverityMeta(activeSelectedAlert.severity).action}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                <span className="text-[0.62rem] text-muted-foreground font-mono">
                  Trace Status: Evaluated Ingest
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAcknowledge(activeSelectedAlert.message)}
                    className="text-xs h-9"
                  >
                    {acknowledgedAlerts.includes(activeSelectedAlert.message) ? (
                      <>
                        <RotateCcw className="size-3.5 mr-1.5" />
                        Re-Open Exception
                      </>
                    ) : (
                      <>
                        <CheckSquare className="size-3.5 mr-1.5" />
                        Acknowledge Issue
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

      </div>

      {/* Premium Glassmorphic Dual-Authorization Secondary Signature Portal Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="bg-card border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border/80 flex flex-col gap-1 bg-muted/15 relative">
              <h3 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                Dual-Authorization Approval
              </h3>
              <p className="text-[0.7rem] text-muted-foreground leading-normal">
                Enforcing internal safety controls: anomalous category expense transactions require verification and secondary sign-off before clearance.
              </p>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAuthorizeSubmit} className="p-6 flex flex-col gap-5">
              {/* Flagged Item Details */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-muted/30">
                <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-widest">Flagged Ledger Exception</span>
                <span className="text-[0.68rem] text-foreground font-semibold leading-relaxed mt-0.5">
                  {activeActionModal.message}
                </span>
              </div>

              {/* Roles Flow */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Primary Signer</span>
                  <input
                    type="text"
                    value={primarySigner}
                    onChange={(e) => setPrimarySigner(e.target.value)}
                    className="h-8 border rounded-lg px-2 text-[0.68rem] font-medium bg-muted/40 cursor-not-allowed select-none text-foreground"
                    disabled
                  />
                  <span className="text-[0.55rem] text-muted-foreground mt-0.5">Senior Accountant</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Secondary Signer</span>
                  <input
                    type="text"
                    value={secondarySigner}
                    onChange={(e) => setSecondarySigner(e.target.value)}
                    className="h-8 border rounded-lg px-2 text-[0.68rem] font-medium bg-background text-foreground"
                    required
                  />
                  <span className="text-[0.55rem] text-muted-foreground mt-0.5">Authorizing Manager</span>
                </div>
              </div>

              {/* PIN / Code Input */}
              <div className="flex flex-col gap-1">
                <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Manager Authorization PIN</span>
                <input
                  type="password"
                  placeholder="Enter 4-digit security PIN (e.g. 1234)"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="h-9.5 border rounded-lg px-3 text-xs bg-background text-foreground"
                  required
                  autoFocus
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2 border-t pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-foreground text-background font-semibold rounded-lg text-xs hover:bg-foreground/90 cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <ShieldCheck className="size-4" />
                  Authorize & Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
