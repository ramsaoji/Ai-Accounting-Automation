import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchSystemSettings, updateSystemSettings } from '@/services/api';
import { toast } from 'sonner';
import { Database, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface HistoryRetentionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeWorkspace: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock';
}

export const HistoryRetentionModal: React.FC<HistoryRetentionModalProps> = ({
  isOpen,
  onOpenChange,
  activeWorkspace,
}) => {
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [godownStockHistoryDays, setGodownStockHistoryDays] = useState(0);
  const [salesHistoryDays, setSalesHistoryDays] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingSettings(true);
      fetchSystemSettings()
        .then((data) => {
          if (data.godownStockHistoryDays !== undefined) {
            setGodownStockHistoryDays(data.godownStockHistoryDays);
          }
          if (data.salesHistoryDays !== undefined) {
            setSalesHistoryDays(data.salesHistoryDays);
          }
        })
        .catch(() => {
          toast.error("Failed to load history retention settings from server.");
        })
        .finally(() => {
          setIsLoadingSettings(false);
        });
    }
  }, [isOpen]);

  const handlePresetSelect = (days: number) => {
    if (activeWorkspace === 'sales') {
      setSalesHistoryDays(days);
    } else {
      setGodownStockHistoryDays(days);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const workspaceName = activeWorkspace === 'sales' ? 'Daily Sales' : activeWorkspace === 'counter_stock' ? 'Counter Stock' : 'Godown Stock';
    const days = activeWorkspace === 'sales' ? salesHistoryDays : godownStockHistoryDays;

    try {
      const payload = activeWorkspace === 'sales'
        ? { salesHistoryDays: days }
        : { godownStockHistoryDays: days };

      const res = await updateSystemSettings(payload);
      if (res.godownStockHistoryDays !== undefined) {
        setGodownStockHistoryDays(res.godownStockHistoryDays);
      }
      if (res.salesHistoryDays !== undefined) {
        setSalesHistoryDays(res.salesHistoryDays);
      }
      window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: res }));
      toast.success(`${workspaceName} retention window updated to ${days === 0 ? 'Latest Only' : days + ' days'}`);
      onOpenChange(false);
    } catch {
      toast.error(`Failed to save ${workspaceName} history retention settings.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalClose = (open: boolean) => {
    onOpenChange(open);
  };

  const currentDays = activeWorkspace === 'sales' ? salesHistoryDays : godownStockHistoryDays;

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
        <DialogHeader className="shrink-0 pb-1">
          <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-1">
            <Database className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-sm font-bold">History Retention Settings</DialogTitle>
          <DialogDescription className="text-xs">
            Configure historical data retention window limits for daily registers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 gap-4 mt-2 overflow-y-auto overscroll-contain pr-1 text-left">
          <div className="flex flex-col gap-4 px-1 py-1">
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                {activeWorkspace === 'sales' ? 'Daily Sales Import Settings' : activeWorkspace === 'counter_stock' ? 'Counter Stock Import Settings' : 'Godown Stock Import Settings'}
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Database className="size-4 text-primary shrink-0" />
                    History Retention Window
                  </span>
                  <Tooltip>
                    <TooltipTrigger render={
                      <button type="button" className="text-muted-foreground hover:text-foreground cursor-help p-0.5 focus:outline-none">
                        <AlertCircle className="size-3" />
                      </button>
                    } />
                    <TooltipContent className="block max-w-[250px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      {activeWorkspace === 'sales'
                        ? 'Keep All Data: Loads and retains all daily sales records in the spreadsheet. Days (e.g. 30/90): Filters and retains only transactions within the selected window from today.'
                        : 'Latest Only: Imports only the current active stock snapshot. Days (e.g. 30/90): Imports current stock and filters historical snapshots to match the selected retention window.'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {activeWorkspace === 'sales'
                    ? 'Specify how many days of historical Daily Sales transaction runs to retain in the database.'
                    : activeWorkspace === 'counter_stock'
                    ? 'Specify how many days of historical Counter Stock snapshots to retain in the database.'
                    : 'Specify how many days of historical Godown Stock snapshots to retain in the database.'}
                </p>

                {isLoadingSettings ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-5 gap-1.5 mt-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-8 rounded-lg" />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-9 w-24 rounded-md" />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Presets Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-1">
                      {[
                        { label: activeWorkspace === 'sales' ? 'Keep All Data' : 'Latest Only', value: 0 },
                        { label: '30 Days', value: 30 },
                        { label: '90 Days', value: 90 },
                        { label: '180 Days', value: 180 },
                        { label: '365 Days', value: 365 },
                      ].map((p) => {
                        const isSelected = currentDays === p.value;
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => handlePresetSelect(p.value)}
                            className={`h-8 rounded-lg text-[10px] font-semibold transition-all select-none cursor-pointer border ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Input */}
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        Or specify custom days:
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          id="custom-history-days-input"
                          type="number"
                          min="0"
                          max="3650"
                          placeholder="—"
                          value={currentDays === 0 ? '' : currentDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const parsedVal = isNaN(val) ? 0 : val;
                            if (activeWorkspace === 'sales') {
                              setSalesHistoryDays(parsedVal);
                            } else {
                              setGodownStockHistoryDays(parsedVal);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-16 h-9 bg-background border border-border rounded-md px-2 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                        />
                        <span className="text-xs text-muted-foreground shrink-0 font-medium">days</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 mt-4 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={isSaving}
            onClick={() => handleModalClose(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="default"
            disabled={isLoadingSettings || isSaving}
            onClick={handleSaveSettings}
            className="text-xs font-semibold cursor-pointer shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[105px]"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5 justify-center">
                <Loader2 className="size-3 animate-spin shrink-0" />
                Saving...
              </span>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
