import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { Alert } from '@/types';
import {
  Flame,
  AlertCircle,
  AlertOctagon,
  Info
} from 'lucide-react';
import { AuditorStats } from './auditor/AuditorStats';
import { ExceptionsFeed } from './auditor/ExceptionsFeed';
import { AnomalyInspector } from './auditor/AnomalyInspector';
import { AuthorizeModal } from './auditor/AuthorizeModal';

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

  const handleAuthorizeApproved = (secondarySigner: string) => {
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
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Title */}
      <div className="border-b pb-4 md:pb-5">
        <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
          Audit Anomaly Board
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time security and compliance issues scanned from accounting spreadsheets.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <AuditorStats
        totalTransactions={totalTransactions}
        activeExceptionsCount={alerts.length}
        criticalCount={criticalCount}
        exceptionRatio={exceptionRatio}
      />

      {/* Datadog / Sentry Split-pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mt-1 items-start lg:h-[calc(100dvh-13rem)]">
        {/* Left Column Pane Exceptions Feed */}
        <ExceptionsFeed
          activeLeftTab={activeLeftTab}
          setActiveLeftTab={setActiveLeftTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          filteredAlerts={filteredAlerts}
          displayAlerts={displayAlerts}
          selectedAlert={activeSelectedAlert}
          setSelectedAlertIndex={(idx: number | null) => setSelectedAlertIndex(idx)}
          acknowledgedAlerts={acknowledgedAlerts}
          severityCounts={severityCounts}
          getSeverityMeta={getSeverityMeta}
        />

        {/* Right Column Pane Inspector */}
        <AnomalyInspector
          activeSelectedAlert={activeSelectedAlert}
          getSeverityMeta={getSeverityMeta}
          acknowledgedAlerts={acknowledgedAlerts}
          onResolve={(alert: Alert) => setActiveActionModal(alert)}
          onToggleAcknowledge={toggleAcknowledge}
        />
      </div>

      {/* Authorization Signoff Modal */}
      {activeActionModal && (
        <AuthorizeModal
          activeActionModal={activeActionModal}
          onClose={() => setActiveActionModal(null)}
          onAuthorizeApproved={handleAuthorizeApproved}
        />
      )}
    </div>
  );
};
