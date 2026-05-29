import React from 'react';
import { Cpu, Calendar } from 'lucide-react';

interface SafetyChecksGuideProps {
  scanScheduleLabel: string;
}

export const SafetyChecksGuide: React.FC<SafetyChecksGuideProps> = ({ scanScheduleLabel }) => {
  return (
    <div className="border border-border/80 rounded-xl p-4 md:p-5 bg-muted/15 flex flex-col gap-3 md:gap-4 mt-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
            <Cpu className="size-5" />
          </div>
          <div>
            <h4 className="font-bold text-foreground text-sm">Automated Bookkeeping Safety Checks</h4>
            <p className="text-[0.75rem] text-muted-foreground mt-1 leading-normal max-w-2xl">
              Every spreadsheet ingestion automatically passes through our <strong>Smart Integrity Engine</strong>. 
              We scan all sales registers and debtor ledgers to safeguard Hotel Gaurav's finances from supplier double-billing, pricing spikes, or manual bookkeeping typos, sending instant alerts to your AI Strategic Advisor.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[0.68rem] text-muted-foreground font-mono bg-background border px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-auto select-none">
          <Calendar className="size-3.5" />
          <span>Sync Schedule: {scanScheduleLabel}</span>
        </div>
      </div>

      {/* Audit Scope Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-border/50 select-none">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
          <span className="text-base select-none">🚫</span>
          <div className="flex flex-col">
            <span className="font-bold text-[0.68rem] text-foreground">Duplicate Bills</span>
            <span className="text-[0.58rem] text-muted-foreground">Catches double-entered invoice numbers</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
          <span className="text-base select-none">💸</span>
          <div className="flex flex-col">
            <span className="font-bold text-[0.68rem] text-foreground">Large Expenses</span>
            <span className="text-[0.58rem] text-muted-foreground">Flags bills &amp; payments &ge; ₹50,000</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
          <span className="text-base select-none">📈</span>
          <div className="flex flex-col">
            <span className="font-bold text-[0.68rem] text-foreground">Cost Spikes</span>
            <span className="text-[0.58rem] text-muted-foreground">Alerts on 3x category average jumps</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
          <span className="text-base select-none">🕒</span>
          <div className="flex flex-col">
            <span className="font-bold text-[0.68rem] text-foreground">Late Logging</span>
            <span className="text-[0.58rem] text-muted-foreground">Flags weekend or off-hours posting</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
          <span className="text-base select-none">⚠️</span>
          <div className="flex flex-col">
            <span className="font-bold text-[0.68rem] text-foreground">Value Check</span>
            <span className="text-[0.58rem] text-muted-foreground">Flags zero/negative amounts</span>
          </div>
        </div>
      </div>
    </div>
  );
};
