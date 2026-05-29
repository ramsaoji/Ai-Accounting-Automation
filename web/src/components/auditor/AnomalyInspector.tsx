import React from 'react';
import { FileWarning, ExternalLink, ShieldCheck, RotateCcw, CheckSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Alert } from '../../types';

interface AnomalyInspectorProps {
  activeSelectedAlert: Alert | null;
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
  acknowledgedAlerts: string[];
  onResolve: (alert: Alert) => void;
  onToggleAcknowledge: (message: string) => void;
}

export const AnomalyInspector: React.FC<AnomalyInspectorProps> = ({
  activeSelectedAlert,
  getSeverityMeta,
  acknowledgedAlerts,
  onResolve,
  onToggleAcknowledge
}) => {
  if (!activeSelectedAlert) {
    return (
      <Card className="lg:col-span-3 border bg-card/45 h-auto lg:h-full min-h-[350px] lg:min-h-0 overflow-hidden flex flex-col items-center justify-center text-center p-8 select-none">
        <FileWarning className="size-10 text-muted-foreground/60 mb-3" />
        <h3 className="text-xs font-bold text-foreground">No Selected Anomaly</h3>
        <p className="text-[0.7rem] text-muted-foreground max-w-xs mt-1.5 leading-normal">
          Click on any exception entry in the left feed to launch the transaction debugger and audit stack trace.
        </p>
      </Card>
    );
  }

  const meta = getSeverityMeta(activeSelectedAlert.severity);
  const isAck = acknowledgedAlerts.includes(activeSelectedAlert.message);

  return (
    <Card className="lg:col-span-3 border bg-card/45 h-auto lg:h-full min-h-[350px] lg:min-h-0 overflow-hidden flex flex-col justify-between min-w-0">
      {/* Header Details */}
      <div className="p-4 md:p-6 border-b border-border/80 flex flex-col gap-2 md:gap-3 select-none">
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
            {meta.icon}
            {activeSelectedAlert.ruleName}
          </h3>
          <span className={`text-[0.62rem] font-bold px-2 py-1 rounded border uppercase tracking-wider self-start sm:self-auto flex items-center gap-1.5 ${
            meta.badge
          }`}>
            {React.cloneElement(meta.icon as React.ReactElement<any>, { className: "size-3" })}
            {activeSelectedAlert.severity} Severity
          </span>
        </div>
      </div>

      {/* Inspector Content Panel */}
      <div className="p-4 md:p-6 flex-1 overflow-y-auto flex flex-col gap-4 md:gap-5">
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
        <div className="flex flex-col gap-2.5 border-t pt-4 select-none">
          <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">
            Rule Logic & Action Plan
          </span>
          <div className="text-xs leading-relaxed font-medium text-foreground flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[0.58rem] font-bold text-muted-foreground/80 uppercase tracking-wider">Rule Logic</span>
              <p className="text-muted-foreground text-[0.7rem] leading-relaxed font-medium">
                {meta.logic}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.58rem] font-bold text-muted-foreground/80 uppercase tracking-wider">Action Plan</span>
              <p className="text-foreground text-[0.72rem] leading-relaxed font-semibold">
                {meta.action}
              </p>
            </div>
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() => onResolve(activeSelectedAlert)}
                className="font-semibold cursor-pointer flex items-center gap-1.5 w-fit"
              >
                <ShieldCheck className="size-3.5" />
                Resolve with Manager Sign-off
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="border-t p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <span className="text-[0.62rem] text-muted-foreground font-mono">
          Trace Status: Evaluated Ingest
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleAcknowledge(activeSelectedAlert.message)}
            className="text-xs h-10 sm:h-9"
          >
            {isAck ? (
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
    </Card>
  );
};
