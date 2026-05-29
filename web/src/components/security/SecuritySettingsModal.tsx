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
import { changeSecurityPasswords } from '@/services/api';
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
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setIsUpdating(false);
    setErrors({});
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val as 'app-lock' | 'upload');
    // Clear new password fields when switching tabs for clean UX,
    // but keep currentPassword so they don't have to retype it.
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
    setErrors({});
  };

  const handleModalClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      reset();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = "Current app passcode is required.";
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = "New passcode is required.";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Confirmation passcode is required.";
    } else if (newPassword.trim() && newPassword.trim() !== confirmPassword.trim()) {
      newErrors.confirmPassword = "New passcodes do not match.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
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
        setErrors({ currentPassword: result.error || "Failed to update passcode. Verify current passcode." });
      }
    } catch {
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

        <form onSubmit={handleSubmit} noValidate className="w-full flex flex-col gap-4">
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

            {/* Verify Current Password (Required for either action) */}
            <div className="flex flex-col gap-1 text-left mt-4">
              <label htmlFor="current-app-passcode" className={`text-[10px] font-bold uppercase tracking-wider ${errors.currentPassword ? 'text-destructive' : 'text-muted-foreground'}`}>
                Verify Current App Passcode *
              </label>
              <div className="relative w-full">
                <input
                  id="current-app-passcode"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errors.currentPassword) {
                      setErrors(prev => ({ ...prev, currentPassword: undefined }));
                    }
                  }}
                  placeholder="Enter current app passcode to authorize…"
                  aria-label="Current app passcode"
                  className={`w-full bg-background border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 transition-all duration-200 ${
                    errors.currentPassword
                      ? 'border-destructive focus:ring-destructive focus:border-destructive'
                      : 'border-border focus:ring-primary focus:border-primary'
                  }`}
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
              {errors.currentPassword && (
                <span className="text-[10px] text-destructive font-semibold mt-1 animate-in slide-in-from-top-1 duration-150">
                  {errors.currentPassword}
                </span>
              )}
            </div>

            <div className="h-px bg-border/60 my-2" />

            <TabsContent value="app-lock" className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {/* New App Lock Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="new-app-lock-passcode" className={`text-[10px] font-bold uppercase tracking-wider ${errors.newPassword ? 'text-destructive' : 'text-muted-foreground'}`}>
                    New App Lock Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="new-app-lock-passcode"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errors.newPassword) {
                          setErrors(prev => ({ ...prev, newPassword: undefined }));
                        }
                      }}
                      placeholder="Enter new app lock passcode…"
                      aria-label="New app lock passcode"
                      className={`w-full bg-background border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 transition-all duration-200 ${
                        errors.newPassword
                          ? 'border-destructive focus:ring-destructive focus:border-destructive'
                          : 'border-border focus:ring-primary focus:border-primary'
                      }`}
                      disabled={isUpdating}
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
                  {errors.newPassword && (
                    <span className="text-[10px] text-destructive font-semibold mt-1 animate-in slide-in-from-top-1 duration-150">
                      {errors.newPassword}
                    </span>
                  )}
                </div>

                {/* Confirm New App Lock Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="confirm-app-lock-passcode" className={`text-[10px] font-bold uppercase tracking-wider ${errors.confirmPassword ? 'text-destructive' : 'text-muted-foreground'}`}>
                    Confirm New App Lock Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="confirm-app-lock-passcode"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      placeholder="Re-type new app lock passcode…"
                      aria-label="Confirm new app lock passcode"
                      className={`w-full bg-background border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 transition-all duration-200 ${
                        errors.confirmPassword
                          ? 'border-destructive focus:ring-destructive focus:border-destructive'
                          : 'border-border focus:ring-primary focus:border-primary'
                      }`}
                      disabled={isUpdating}
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
                  {errors.confirmPassword && (
                    <span className="text-[10px] text-destructive font-semibold mt-1 animate-in slide-in-from-top-1 duration-150">
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {/* New Upload Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="new-upload-passcode" className={`text-[10px] font-bold uppercase tracking-wider ${errors.newPassword ? 'text-destructive' : 'text-muted-foreground'}`}>
                    New Upload Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="new-upload-passcode"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errors.newPassword) {
                          setErrors(prev => ({ ...prev, newPassword: undefined }));
                        }
                      }}
                      placeholder="Enter new upload passcode…"
                      aria-label="New upload passcode"
                      className={`w-full bg-background border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 transition-all duration-200 ${
                        errors.newPassword
                          ? 'border-destructive focus:ring-destructive focus:border-destructive'
                          : 'border-border focus:ring-primary focus:border-primary'
                      }`}
                      disabled={isUpdating}
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
                  {errors.newPassword && (
                    <span className="text-[10px] text-destructive font-semibold mt-1 animate-in slide-in-from-top-1 duration-150">
                      {errors.newPassword}
                    </span>
                  )}
                </div>

                {/* Confirm New Upload Password */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="confirm-upload-passcode" className={`text-[10px] font-bold uppercase tracking-wider ${errors.confirmPassword ? 'text-destructive' : 'text-muted-foreground'}`}>
                    Confirm New Upload Passcode *
                  </label>
                  <div className="relative w-full">
                    <input
                      id="confirm-upload-passcode"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      placeholder="Re-type new upload passcode…"
                      aria-label="Confirm new upload passcode"
                      className={`w-full bg-background border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 transition-all duration-200 ${
                        errors.confirmPassword
                          ? 'border-destructive focus:ring-destructive focus:border-destructive'
                          : 'border-border focus:ring-primary focus:border-primary'
                      }`}
                      disabled={isUpdating}
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
                  {errors.confirmPassword && (
                    <span className="text-[10px] text-destructive font-semibold mt-1 animate-in slide-in-from-top-1 duration-150">
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
      </DialogContent>
    </Dialog>
  );
};
