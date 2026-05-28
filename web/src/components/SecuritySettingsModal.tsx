import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { changeSecurityPasswords } from '../services/api';
import { toast } from 'sonner';
import { Key, Eye, EyeOff, Loader2, Lock, Upload } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [activeTab, setActiveTab] = useState<'app-lock' | 'upload'>('app-lock');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setIsUpdating(false);
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val as 'app-lock' | 'upload');
    // Clear new password fields when switching tabs for clean UX,
    // but keep currentPassword so they don't have to retype it.
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleModalClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      reset();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword.trim()) {
      toast.error("Current app passcode is required to authorize changes.");
      return;
    }

    if (!newPassword.trim()) {
      toast.error("New passcode is required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passcodes do not match.");
      return;
    }

    setIsUpdating(true);
    try {
      const result = await changeSecurityPasswords(
        currentPassword,
        activeTab === 'upload' ? newPassword.trim() : undefined,
        activeTab === 'app-lock' ? newPassword.trim() : undefined
      );

      if (result.success) {
        toast.success(
          activeTab === 'app-lock'
            ? "App Lock passcode updated successfully!"
            : "Upload passcode updated successfully!"
        );
        reset();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to update passcode. Verify current passcode.");
      }
    } catch (err) {
      toast.error("Request failed. Please verify server connection.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md select-none animate-in fade-in duration-200">
        <DialogHeader>
          <div className="size-11 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20 mb-1">
            <Key className="size-5 text-warning" />
          </div>
          <DialogTitle className="text-sm font-bold">Update Security Credentials</DialogTitle>
          <DialogDescription className="text-xs">
            Modify either the app-wide lock passcode or the upload authorization passcode.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TooltipProvider>
            <TabsList className="w-full flex h-12 sm:h-11 p-1 bg-muted rounded-xl">
              <Tooltip>
                <TooltipTrigger render={
                  <TabsTrigger
                    value="app-lock"
                    className="cursor-pointer select-none text-xs sm:text-sm font-semibold dark:data-active:bg-background dark:data-active:border-transparent data-active:shadow-sm text-muted-foreground data-active:text-foreground transition-all duration-150 flex-1"
                  >
                    <Lock className="size-4" />
                    App Lock Passcode
                  </TabsTrigger>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Modify the app-wide passcode required to unlock the main application dashboard from the lock screen.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={
                  <TabsTrigger
                    value="upload"
                    className="cursor-pointer select-none text-xs sm:text-sm font-semibold dark:data-active:bg-background dark:data-active:border-transparent data-active:shadow-sm text-muted-foreground data-active:text-foreground transition-all duration-150 flex-1"
                  >
                    <Upload className="size-4" />
                    Upload Passcode
                  </TabsTrigger>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Modify the security passcode required to authorize daily sales or outstanding debitors spreadsheet uploads.
                </TooltipContent>
              </Tooltip>
            </TabsList>
          </TooltipProvider>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2 mt-2">
            {/* Verify Current Password (Required for either action) */}
            <div className="flex flex-col gap-1 text-left">
              <label htmlFor="current-app-passcode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Verify Current App Passcode *
              </label>
              <div className="relative w-full">
                <input
                  id="current-app-passcode"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current app passcode to authorize…"
                  aria-label="Current app passcode"
                  className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                  required
                  disabled={isUpdating}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  className="absolute right-3 top-2.5 text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="h-px bg-border/60 my-1" />

            <TabsContent value="app-lock" className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {/* New App Lock Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="new-app-lock-passcode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    New App Lock Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="new-app-lock-passcode"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new app lock passcode…"
                      aria-label="New app lock passcode"
                      className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                      disabled={isUpdating}
                      required={activeTab === 'app-lock'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? 'Hide new password' : 'Show new password'}
                      className="absolute right-3 top-2.5 text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New App Lock Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="confirm-app-lock-passcode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Confirm New App Lock Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="confirm-app-lock-passcode"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new app lock passcode…"
                      aria-label="Confirm new app lock passcode"
                      className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                      disabled={isUpdating}
                      required={activeTab === 'app-lock'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-2.5 text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {/* New Upload Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="new-upload-passcode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    New Upload Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="new-upload-passcode"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new upload passcode…"
                      aria-label="New upload passcode"
                      className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                      disabled={isUpdating}
                      required={activeTab === 'upload'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? 'Hide new password' : 'Show new password'}
                      className="absolute right-3 top-2.5 text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Upload Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="confirm-upload-passcode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Confirm New Upload Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="confirm-upload-passcode"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new upload passcode…"
                      aria-label="Confirm new upload passcode"
                      className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                      disabled={isUpdating}
                      required={activeTab === 'upload'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-2.5 text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <DialogFooter className="sm:justify-between gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => handleModalClose(false)}
                disabled={isUpdating}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="default"
                disabled={isUpdating}
                className="text-xs font-semibold cursor-pointer shrink-0"
              >
                {isUpdating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Updating…
                  </span>
                ) : (
                  activeTab === 'app-lock' ? 'Update App Lock Passcode' : 'Update Upload Passcode'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
