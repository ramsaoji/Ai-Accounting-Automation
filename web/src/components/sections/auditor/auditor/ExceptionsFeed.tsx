import React from 'react';
import { Search, Sliders, Sparkles, Ban, Info, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Alert } from '@/types';
import { Slider } from '@/components/ui/slider';
import type { SystemSettings } from '@/services/api';

interface ExceptionsFeedProps {
  activeLeftTab: 'feed' | 'policies';
  setActiveLeftTab: (tab: 'feed' | 'policies') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  severityFilter: 'all' | 'critical' | 'high' | 'medium' | 'low';
  setSeverityFilter: (sev: 'all' | 'critical' | 'high' | 'medium' | 'low') => void;
  filteredAlerts: Alert[];
  displayAlerts: Alert[];
  selectedAlert: Alert | null;
  setSelectedAlertIndex: (idx: number) => void;
  acknowledgedAlerts: string[];
  severityCounts: {
    all: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  getSeverityMeta: (severity: Alert['severity']) => {
    icon: React.ReactElement;
    dot: string;
    badge: string;
    text: string;
    border: string;
    action: string;
    priority: string;
    logic: string;
  };
  settings: SystemSettings | null;
  onUpdateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
}

export const ExceptionsFeed: React.FC<ExceptionsFeedProps> = ({
  activeLeftTab,
  setActiveLeftTab,
  searchTerm,
  setSearchTerm,
  severityFilter,
  setSeverityFilter,
  filteredAlerts,
  displayAlerts,
  selectedAlert,
  setSelectedAlertIndex,
  acknowledgedAlerts,
  severityCounts,
  getSeverityMeta,
  settings,
  onUpdateSettings
}) => {
  const [localHighExpense, setLocalHighExpense] = React.useState(50000);
  const [localSpikeMultiplier, setLocalSpikeMultiplier] = React.useState(3);
  const [localCreditCap, setLocalCreditCap] = React.useState(100000);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setLocalHighExpense(settings.ruleHighExpenseCeiling ?? 50000);
      setLocalSpikeMultiplier(settings.ruleSuspiciousSpikeMultiplier ?? 3);
      setLocalCreditCap(settings.ruleOutstandingCreditCap ?? 100000);
    }
  }, [settings]);

  const handleApply = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings({
        ruleHighExpenseCeiling: localHighExpense,
        ruleSuspiciousSpikeMultiplier: localSpikeMultiplier,
        ruleOutstandingCreditCap: localCreditCap
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="lg:col-span-2 flex flex-col border rounded-xl overflow-hidden bg-card/45 h-[450px] lg:h-full min-h-0 shrink-0 min-w-0">
      {/* Tab Selector Header */}
      <div className="flex border-b bg-muted/20 select-none">
        <button
          type="button"
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
          type="button"
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

      <div className="pt-4 pl-4 pb-4 pr-0 flex-1 flex flex-col overflow-hidden">
        {activeLeftTab === 'feed' ? (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Search / Filters toolbar */}
            <div className="flex flex-col gap-2.5 pr-4">
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
              <div className="flex flex-wrap gap-1.5 select-none">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                  <button
                    type="button"
                    key={sev}
                    onClick={() => {
                      setSeverityFilter(sev);
                      setSelectedAlertIndex(0);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold capitalize transition-all duration-200 cursor-pointer select-none ${
                      severityFilter === sev
                        ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/80'
                    }`}
                  >
                    {sev} ({severityCounts[sev]})
                  </button>
                ))}
              </div>
            </div>

            {/* List Container */}
            <div className="flex-1 overflow-y-auto pr-4 pb-4 flex flex-col gap-2 mt-2">
              {displayAlerts.length === 0 ? (
                <div className="text-center py-16 text-xs text-muted-foreground font-medium">
                  No issues matched search query.
                </div>
              ) : (
                displayAlerts.map((anomaly, idx) => {
                  const isSelected = selectedAlert?.message === anomaly.message;
                  const isAck = acknowledgedAlerts.includes(anomaly.message);
                  const meta = getSeverityMeta(anomaly.severity);

                  return (
                    <button
                      key={anomaly.message}
                      type="button"
                      onClick={() => setSelectedAlertIndex(idx)}
                      className={`w-full p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 border-l-4 select-none relative shrink-0 ${meta.border} ${
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
                          {React.cloneElement(meta.icon as React.ReactElement<any>, { className: "size-2.5" })}
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
                    </button>
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
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-4 pb-4">
            <div className="flex flex-col gap-1 select-none shrink-0">
              <h4 className="text-xs font-bold text-foreground">Active Auditing Policies</h4>
              <p className="text-[0.7rem] text-muted-foreground leading-normal">
                These rules are enforced deterministically by the backend accounting worker during daily batch execution.
              </p>
            </div>

            {settings === null ? (
              <div className="text-center py-10 text-xs text-muted-foreground font-medium animate-pulse">
                Retrieving policy parameters...
              </div>
            ) : (
              <>
                {/* Policy 1: High Expense */}
                <div className="flex flex-col gap-2.5 p-3.5 border rounded-xl bg-background/50 relative overflow-hidden transition-all duration-300 hover:border-primary/30 shrink-0">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-primary" />
                      High Outflow Ceiling
                    </span>
                    <span className="font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-[0.65rem]">
                      ₹{localHighExpense.toLocaleString()}
                    </span>
                  </div>
                  <div className="py-2.5 px-0.5">
                    <Slider
                      min={5000}
                      max={200000}
                      step={5000}
                      value={[localHighExpense]}
                      onValueChange={(val) => setLocalHighExpense(Array.isArray(val) ? val[0] : val)}
                    />
                  </div>
                  <p className="text-[0.62rem] text-muted-foreground leading-normal">
                    Flags individual supplier invoices, bills, or operational expense logs exceeding ₹{localHighExpense.toLocaleString()}.
                  </p>
                </div>

                {/* Policy 2: Category Spike */}
                <div className="flex flex-col gap-2.5 p-3.5 border rounded-xl bg-background/50 relative overflow-hidden transition-all duration-300 hover:border-amber-500/30 shrink-0">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-amber-500" />
                      Category Spike Threshold
                    </span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[0.65rem]">
                      {localSpikeMultiplier.toFixed(1)}x Average
                    </span>
                  </div>
                  <div className="py-2.5 px-0.5">
                    <Slider
                      min={1.5}
                      max={10.0}
                      step={0.5}
                      value={[localSpikeMultiplier]}
                      onValueChange={(val) => setLocalSpikeMultiplier(Array.isArray(val) ? val[0] : val)}
                    />
                  </div>
                  <p className="text-[0.62rem] text-muted-foreground leading-normal">
                    Triggers when a category debit exceeds {localSpikeMultiplier.toFixed(1)}x the historical monthly average for that operational account.
                  </p>
                </div>

                {/* Policy 3: Outstanding Credit Cap */}
                <div className="flex flex-col gap-2.5 p-3.5 border rounded-xl bg-background/50 relative overflow-hidden transition-all duration-300 hover:border-destructive/30 shrink-0">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Ban className="size-3.5 text-destructive" />
                      Outstanding Credit Cap
                    </span>
                    <span className="font-mono text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded text-[0.65rem]">
                      ₹{localCreditCap.toLocaleString()}
                    </span>
                  </div>
                  <div className="py-2.5 px-0.5">
                    <Slider
                      min={1000}
                      max={100000}
                      step={1000}
                      value={[localCreditCap]}
                      onValueChange={(val) => setLocalCreditCap(Array.isArray(val) ? val[0] : val)}
                    />
                  </div>
                  <p className="text-[0.62rem] text-muted-foreground leading-normal">
                    Flags customer debit accounts in the Debitor Outstanding list carrying pending balances over ₹{localCreditCap.toLocaleString()}.
                  </p>
                </div>

                {/* Policy 4: Off hours banking */}
                <div className="flex flex-col gap-1.5 p-3.5 border rounded-xl bg-background/30 opacity-75 relative overflow-hidden shrink-0">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Info className="size-3.5 text-info" />
                      Off-Hours Banking Window
                    </span>
                    <span className="font-mono text-info bg-info/10 border border-info/20 px-2 py-0.5 rounded text-[0.65rem]">
                      11 PM - 5 AM (IST)
                    </span>
                  </div>
                  <p className="text-[0.62rem] text-muted-foreground leading-normal mt-0.5">
                    Audits booking lag times, flagging journal ledger entries finalized during late-nights or weekends.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleApply}
                  className="w-full py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg border hover:bg-primary/90 transition-all select-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-1 shrink-0"
                >
                  {isSaving ? 'Applying Settings...' : 'Apply Policies'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
