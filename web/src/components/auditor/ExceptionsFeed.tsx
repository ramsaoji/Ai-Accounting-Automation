import React from 'react';
import { Search, Sliders, Sparkles, Ban, Info, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Alert } from '../../types';

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
  getSeverityMeta
}) => {
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
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 mt-2">
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
                      className={`w-full p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 border-l-4 select-none relative ${meta.border} ${
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
  );
};
