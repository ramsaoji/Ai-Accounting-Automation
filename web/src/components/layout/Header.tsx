import React from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { UploadModal } from '@/components/shared/UploadModal';

interface HeaderProps {
  businessName: string;
  activeView: string;
  activeWorkspace: 'sales' | 'debitors';
  connectionMode: 'live' | 'static' | 'empty';
  isSyncingDrive: boolean;
  isUploading: boolean;
  isLoading: boolean;
  hasSyncedBefore?: boolean;
  handleDriveSync: () => Promise<void>;
  onFilesReady: (files: File[], sessionToken: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  businessName,
  activeView,
  activeWorkspace,
  connectionMode,
  isSyncingDrive,
  isUploading,
  isLoading,
  hasSyncedBefore,
  handleDriveSync,
  onFilesReady,
}) => {
  return (
    <header className="h-16 border-b border-border/80 px-4 md:px-6 flex items-center justify-between bg-card select-none">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="hover:bg-muted size-9 sm:size-8 border bg-background cursor-pointer" />
        <div className="w-px h-4 bg-border shrink-0 self-center" aria-hidden="true" />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span className="font-semibold text-foreground hidden sm:inline">{businessName}</span>
          {activeView !== 'portal' && (
            <>
              <span className="hidden sm:inline">/</span>
              <span className="capitalize font-semibold text-foreground hidden md:inline">
                {activeWorkspace === 'sales' ? 'Sales Register' : 'Customer Debitors'}
              </span>
            </>
          )}
          {activeView !== 'portal' && <span className="hidden sm:inline">/</span>}
          <span className="capitalize text-foreground font-semibold sm:font-normal">
            {activeView === 'portal'
              ? 'All Ledgers'
              : activeView === 'overview'
              ? 'Overview'
              : activeView === 'ledger'
              ? 'Ledger'
              : activeView === 'auditor'
              ? 'Auditor Config'
              : 'AI Advisor'}
          </span>
        </div>
      </div>

      {/* Header Actions Tray */}
      <div className="flex items-center gap-3">
        <UploadModal
          hasSyncedBefore={hasSyncedBefore}
          connectionMode={connectionMode}
          disabled={isSyncingDrive || isUploading || (connectionMode !== 'live' && connectionMode !== 'static')}
          onFilesReady={onFilesReady}
        />

        {connectionMode === 'live' && (
          <Button
            onClick={handleDriveSync}
            disabled={isSyncingDrive || isUploading || isLoading}
            variant="outline"
            size="sm"
            className="gap-2 cursor-pointer border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
          >
            {isSyncingDrive ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Cloud className="size-4" />
            )}
            <span className="hidden sm:inline">Sync Drive</span>
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
