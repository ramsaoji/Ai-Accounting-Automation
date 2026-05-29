import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, MessageSquare } from 'lucide-react';
import type { DebitorSummary } from '@/types';

interface RecoveryBoardProps {
  topDebitors: DebitorSummary[];
  businessName: string;
  triggerReminderCopy: (debtor: DebitorSummary) => void;
  formatINR: (val: number) => string;
}

export const RecoveryBoard: React.FC<RecoveryBoardProps> = ({
  topDebitors,
  businessName,
  triggerReminderCopy,
  formatINR,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 mt-1 items-start animate-in fade-in duration-300">
      <Card className="border bg-card/45 shadow-xs overflow-hidden flex flex-col justify-between">
        <div>
          <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/80 flex flex-row items-center gap-3 select-none">
            <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shrink-0">
              <Zap className="size-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Receivable Recovery & Planning</CardTitle>
              <CardDescription className="text-xs">Top priority accounts and automated outreach copy drafts for {businessName}.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
            <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
              Top Priority Accounts
            </span>
            <div className="flex flex-col gap-3">
              {topDebitors.slice(0, 5).map((debtor) => {
                const riskLevel = debtor.pending > 15000 ? 'High Risk' : debtor.pending > 5000 ? 'Medium Risk' : 'Low Risk';
                const statusColorMap = debtor.pending > 15000 
                  ? 'bg-destructive' 
                  : debtor.pending > 5000 
                    ? 'bg-warning' 
                    : 'bg-success';
                const riskColor = debtor.pending > 15000 
                  ? 'bg-destructive/10 text-destructive border-destructive/25' 
                  : debtor.pending > 5000 
                    ? 'bg-warning/10 text-warning border-warning/25' 
                    : 'bg-success/10 text-success border-success/25';

                return (
                  <div
                    key={debtor.name}
                    className="relative overflow-hidden p-4 pl-5 border border-border/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 bg-card/25 hover:bg-card/50 hover:border-primary/25 group select-none shadow-xs"
                  >
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-md transition-all duration-300 ${statusColorMap} opacity-60 group-hover:opacity-100`} />

                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`size-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 font-mono transition-all duration-300 select-none shadow-sm ${
                        debtor.pending > 15000
                          ? 'bg-destructive/10 text-destructive border border-destructive/20 group-hover:bg-destructive/15'
                          : debtor.pending > 5000
                            ? 'bg-warning/10 text-warning border border-warning/20 group-hover:bg-warning/15'
                            : 'bg-success/10 text-success border border-success/20 group-hover:bg-success/15'
                      }`}>
                        {(() => {
                          const p = debtor.name.trim().split(/\s+/);
                          return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : debtor.name.slice(0, 2).toUpperCase();
                        })()}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">{debtor.name}</span>
                          <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md border shrink-0 font-sans leading-none ${riskColor}`}>
                            {riskLevel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <span className="opacity-75">Purchases:</span>
                            <span className="font-mono font-bold text-foreground/90">{formatINR(debtor.debit || 0)}</span>
                          </span>
                          <span className="size-1 rounded-full bg-border shrink-0" />
                          <span className="flex items-center gap-1.5">
                            <span className="opacity-75">Cleared:</span>
                            <span className="font-mono font-bold text-success/90">{formatINR(debtor.credit || 0)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40 w-full sm:w-auto">
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-sm sm:text-base font-extrabold text-destructive font-mono tracking-tight">{formatINR(debtor.pending)}</span>
                        <span className="text-[10px] text-muted-foreground font-bold mt-1 leading-none uppercase tracking-wider">Outstanding Dues</span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          triggerReminderCopy(debtor);
                        }}
                        className="gap-1.5 h-9 sm:h-8 px-3 rounded-lg text-xs font-semibold bg-primary/5 text-primary border border-primary/10 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-xs cursor-pointer transition-all duration-200 shrink-0"
                      >
                        <MessageSquare className="size-3.5 shrink-0" />
                        <span>Remind</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};
