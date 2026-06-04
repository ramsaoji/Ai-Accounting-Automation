import React from 'react';
import { Users, Package } from 'lucide-react';
import { UploadModal } from '@/components/shared/UploadModal';

interface EmptyWorkspaceStateProps {
  activeWorkspace: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock';
  connectionMode: 'live' | 'static' | 'empty';
  onFilesReady: (files: File[], sessionToken: string) => void;
}

export const EmptyWorkspaceState: React.FC<EmptyWorkspaceStateProps> = ({
  activeWorkspace,
  connectionMode,
  onFilesReady,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-border/80 bg-muted/10 rounded-2xl gap-4 select-none my-6 animate-in fade-in duration-300">
      <div className="size-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto">
        {activeWorkspace === 'godown_stock' || activeWorkspace === 'counter_stock' ? <Package className="size-6" /> : <Users className="size-6" />}
      </div>
      <div className="flex flex-col gap-1.5 max-w-sm">
        <h3 className="text-sm font-bold text-foreground">
          {activeWorkspace === 'sales'
            ? 'Daily Sales Register Required'
            : activeWorkspace === 'debitors'
            ? 'Outstanding Debitors Ledger Required'
            : activeWorkspace === 'counter_stock'
            ? 'Counter Stock Register Required'
            : 'Godown Stock Register Required'}
        </h3>
        <p className="text-xs text-muted-foreground leading-normal">
          {activeWorkspace === 'sales'
            ? 'Upload your Daily Sales Register spreadsheet to configure metrics, cash flow timelines, and compliance audits.'
            : activeWorkspace === 'debitors'
            ? 'Upload your DEBITORS LIST spreadsheet to audit outstanding udhari, clearance percentages, and risk indexes.'
            : activeWorkspace === 'counter_stock'
            ? 'Upload your Counter Stock Register spreadsheet to audit product quantities, category valuations, and movement trends.'
            : 'Upload your Godown Stock Register spreadsheet to audit product quantities, category valuations, and movement trends.'}
        </p>
      </div>
      <div className="mt-2">
        <UploadModal disabled={connectionMode !== 'live' && connectionMode !== 'static'} onFilesReady={onFilesReady} />
      </div>
    </div>
  );
};

export default EmptyWorkspaceState;

