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
import { changeSecurityPasswords, fetchSystemSettings, updateSystemSettings, type SystemSettings } from '@/services/api';
import { toast } from 'sonner';
import { Key, Eye, EyeOff, Loader2, Lock, Upload, Settings, Laptop, Send, Sparkles, Bot } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SystemSettingsSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 px-1 py-1">
      {/* Section 1: AI Engine Configuration */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-24" />
        
        {/* Active AI Provider */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-8 w-full sm:w-[180px]" />
        </div>

        {/* Active Model Name */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-8 w-full sm:w-[180px]" />
        </div>
      </div>

      <div className="h-px bg-border/40 my-1" />

      {/* Section 2: Channel Activations */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-28" />
        
        {/* Web UI AI Chat Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>

        {/* Telegram Bot AI Chat Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [activeTab, setActiveTab] = useState<'app-lock' | 'upload' | 'system-settings'>('app-lock');
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

  const [webChatEnabled, setWebChatEnabled] = useState(true);
  const [telegramChatEnabled, setTelegramChatEnabled] = useState(true);
  const [aiProvider, setAiProvider] = useState('none');
  const [aiModel, setAiModel] = useState('none');
  const [availableProviders, setAvailableProviders] = useState<string[]>(['none']);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  React.useEffect(() => {
    if (isOpen && activeTab === 'system-settings') {
      setIsLoadingSettings(true);
      fetchSystemSettings()
        .then((data) => {
          setWebChatEnabled(data.webChatEnabled);
          setTelegramChatEnabled(data.telegramChatEnabled);
          setAiProvider(data.aiProvider || 'none');
          setAiModel(data.aiModel || 'none');
          if (data.availableProviders) {
            setAvailableProviders(data.availableProviders);
          }
        })
        .catch(() => {
          toast.error("Failed to load system settings from server.");
        })
        .finally(() => {
          setIsLoadingSettings(false);
        });
    }
  }, [isOpen, activeTab]);

  const handleToggleWebChat = (newValue: boolean) => {
    if (newValue && (aiProvider === 'none' || !aiModel.trim() || aiModel === 'none')) {
      toast.warning("Cannot enable chat: Please select a valid AI Provider and enter a Model name first.");
      return;
    }
    setWebChatEnabled(newValue);
  };

  const handleToggleTelegramChat = (newValue: boolean) => {
    if (newValue && (aiProvider === 'none' || !aiModel.trim() || aiModel === 'none')) {
      toast.warning("Cannot enable chat: Please select a valid AI Provider and enter a Model name first.");
      return;
    }
    setTelegramChatEnabled(newValue);
  };

  const handleProviderChange = (value: string | null) => {
    const newProvider = value || 'none';
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      gemini: 'gemini-2.5-flash',
      claude: 'claude-3-5-sonnet-20240620',
      deepseek: 'deepseek-chat',
      groq: 'llama-3.3-70b-versatile',
      openrouter: 'google/gemini-2.0-flash-exp:free',
      none: 'none'
    };

    const targetModel = defaultModels[newProvider] || 'none';
    const disableChats = newProvider === 'none' || targetModel === 'none';

    setAiProvider(newProvider);
    setAiModel(targetModel);
    if (disableChats) {
      setWebChatEnabled(false);
      setTelegramChatEnabled(false);
    }
  };

  const handleModelChange = (newModel: string) => {
    setAiModel(newModel);
  };

  const handleModelBlur = (newModel: string) => {
    const trimmed = newModel.trim();
    setAiModel(trimmed);
    const disableChats = trimmed === '' || trimmed === 'none';
    if (disableChats) {
      setWebChatEnabled(false);
      setTelegramChatEnabled(false);
    }
  };

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
    setActiveTab(val as 'app-lock' | 'upload' | 'system-settings');
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

    if (activeTab === 'system-settings') {
      const trimmedModel = aiModel.trim();
      if (aiProvider !== 'none' && (trimmedModel === '' || trimmedModel === 'none')) {
        toast.warning("Please enter a valid Model Identifier for the selected provider.");
        return;
      }

      setIsUpdating(true);
      try {
        const disableChats = aiProvider === 'none' || trimmedModel === '' || trimmedModel === 'none';
        const payload: Partial<SystemSettings> = {
          aiProvider,
          aiModel: trimmedModel,
          webChatEnabled: disableChats ? false : webChatEnabled,
          telegramChatEnabled: disableChats ? false : telegramChatEnabled,
        };

        const res = await updateSystemSettings(payload);
        setAiProvider(res.aiProvider);
        setAiModel(res.aiModel);
        setWebChatEnabled(res.webChatEnabled);
        setTelegramChatEnabled(res.telegramChatEnabled);
        if (res.availableProviders) {
          setAvailableProviders(res.availableProviders);
        }

        window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: res }));
        toast.success("System settings updated successfully.");
        onOpenChange(false);
      } catch {
        toast.error("Failed to update system settings. Please try again.");
      } finally {
        setIsUpdating(false);
      }
      return;
    }

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

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'app-lock':
        return {
          title: "Update Security Credentials",
          description: "Modify the app-wide passcode required to unlock the dashboard."
        };
      case 'upload':
        return {
          title: "Update Security Credentials",
          description: "Modify the security passcode required to authorize spreadsheet uploads."
        };
      case 'system-settings':
        return {
          title: "System Settings",
          description: "Manage system-wide configuration parameters for the AI Advisor."
        };
      default:
        return {
          title: "Update Security Credentials",
          description: "Modify either the app-wide lock passcode or the upload authorization passcode."
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
        <DialogHeader className="shrink-0 pb-1">
          <div className="size-11 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20 mb-1">
            <Key className="size-5 text-warning" />
          </div>
          <DialogTitle className="text-sm font-bold">{headerInfo.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {headerInfo.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 gap-4 mt-2 overflow-visible">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TooltipProvider>
              <TabsList className="w-full flex h-12 sm:h-11 p-1 bg-muted rounded-xl">
                <Tooltip>
                  <TooltipTrigger render={
                    <TabsTrigger
                      value="app-lock"
                      className="cursor-pointer select-none text-xs sm:text-sm font-semibold dark:data-active:bg-background dark:data-active:border-transparent data-active:shadow-sm text-muted-foreground data-active:text-foreground transition-all duration-150 flex-1"
                    >
                      <Lock className="size-4" />
                      App Lock
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
                      Upload
                    </TabsTrigger>
                  } />
                  <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                    Modify the security passcode required to authorize daily sales or outstanding debitors spreadsheet uploads.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={
                    <TabsTrigger
                      value="system-settings"
                      className="cursor-pointer select-none text-xs sm:text-sm font-semibold dark:data-active:bg-background dark:data-active:border-transparent data-active:shadow-sm text-muted-foreground data-active:text-foreground transition-all duration-150 flex-1"
                    >
                      <Settings className="size-4" />
                      AI Toggle
                    </TabsTrigger>
                  } />
                  <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                    Enable or disable the AI Advisor chat assistant system-wide for both the Web UI and Telegram Bot.
                  </TooltipContent>
                </Tooltip>
              </TabsList>
            </TooltipProvider>

          {/* Verify Current Password (Required for either action) */}
          {activeTab !== 'system-settings' && (
            <>
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
            </>
          )}

          <TabsContent value="app-lock" className="overflow-y-auto overscroll-contain pr-1 mt-2 flex-1 focus-visible:outline-none">
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

          <TabsContent value="upload" className="overflow-y-auto overscroll-contain pr-1 mt-2 flex-1 focus-visible:outline-none">
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

          <TabsContent value="system-settings" className="overflow-y-auto overscroll-contain pr-1 mt-2 flex-1 focus-visible:outline-none text-left">
            {isLoadingSettings ? (
              <SystemSettingsSkeleton />
            ) : (
              <div className="flex flex-col gap-5 animate-in fade-in duration-200 px-1 py-1">
                
                {/* Section 1: AI Engine Configuration */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    AI Engine Config
                  </h3>
                  
                  {/* Active AI Provider (Select on the right) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="size-4 text-primary shrink-0" />
                      AI Provider
                    </span>
                    <div className="w-full sm:w-auto">
                      <Select
                        value={aiProvider}
                        onValueChange={handleProviderChange}
                        disabled={isLoadingSettings || isUpdating}
                      >
                        <SelectTrigger id="ai-provider-select" className="w-full sm:w-[180px] bg-background border border-border rounded-md px-3 py-2 text-xs text-foreground cursor-pointer justify-between focus:ring-1 focus:ring-primary focus:border-primary transition-all">
                          <SelectValue placeholder="Select active AI engine..." />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border/80 shadow-lg rounded-lg text-xs z-50">
                          {availableProviders.includes('none') && <SelectItem value="none">Disabled (No AI)</SelectItem>}
                          {availableProviders.includes('openai') && <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>}
                          {availableProviders.includes('gemini') && <SelectItem value="gemini">Google Gemini</SelectItem>}
                          {availableProviders.includes('claude') && <SelectItem value="claude">Anthropic Claude</SelectItem>}
                          {availableProviders.includes('deepseek') && <SelectItem value="deepseek">DeepSeek AI</SelectItem>}
                          {availableProviders.includes('groq') && <SelectItem value="groq">Groq (Ultra-Fast)</SelectItem>}
                          {availableProviders.includes('openrouter') && <SelectItem value="openrouter">OpenRouter (Free Tiers)</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Active Model Name (Input on the right) */}
                  {aiProvider !== 'none' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <Bot className="size-4 text-primary shrink-0" />
                        Model Identifier
                      </span>
                      <div className="w-full sm:w-auto">
                        <input
                          id="ai-model-input"
                          type="text"
                          value={aiModel}
                          onChange={(e) => handleModelChange(e.target.value)}
                          onBlur={(e) => handleModelBlur(e.target.value)}
                          disabled={isLoadingSettings || isUpdating}
                          placeholder="e.g. gemini-2.5-flash"
                          className="w-full sm:w-[180px] bg-background border border-border rounded-md px-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/45 text-left focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-border/40 my-1" />

                {/* Section 2: Channel Activations */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    Access Channels
                  </h3>
                  
                  {/* 1. Web UI AI Chat Toggle */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                      {webChatEnabled && aiProvider !== 'none' && aiModel !== 'none' && aiModel.trim() !== '' ? (
                        <Laptop className="size-4 text-emerald-500 animate-pulse" />
                      ) : (
                        <Laptop className="size-4 text-muted-foreground" />
                      )}
                      Web Advisor Chat
                    </span>

                    {isLoadingSettings ? (
                      <Loader2 className="size-5 text-primary animate-spin shrink-0" />
                    ) : (
                      <div
                        onClick={() => {
                          if (aiProvider === 'none' || aiModel === 'none' || !aiModel.trim()) {
                            toast.warning("Cannot enable chat: Please configure an active AI Provider and Model first.");
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleWebChat(!webChatEnabled);
                          }}
                          aria-label="Toggle Web UI Advisor Chat"
                          disabled={aiProvider === 'none' || aiModel === 'none' || !aiModel.trim()}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed ${
                            webChatEnabled && aiProvider !== 'none' && aiModel !== 'none' && aiModel.trim() !== '' ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                              webChatEnabled && aiProvider !== 'none' && aiModel !== 'none' && aiModel.trim() !== '' ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Telegram Bot AI Chat Toggle */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                      {telegramChatEnabled && aiProvider !== 'none' && aiModel !== 'none' && aiModel.trim() !== '' ? (
                        <Send className="size-4 text-emerald-500 animate-pulse" />
                      ) : (
                        <Send className="size-4 text-muted-foreground" />
                      )}
                      Telegram Bot Advisor
                    </span>

                    {isLoadingSettings ? (
                      <Loader2 className="size-5 text-primary animate-spin shrink-0" />
                    ) : (
                      <div
                        onClick={() => {
                          if (aiProvider === 'none' || aiModel === 'none' || !aiModel.trim()) {
                            toast.warning("Cannot enable chat: Please configure an active AI Provider and Model first.");
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTelegramChat(!telegramChatEnabled);
                          }}
                          aria-label="Toggle Telegram Bot Chat"
                          disabled={aiProvider === 'none' || aiModel === 'none' || !aiModel.trim()}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed ${
                            telegramChatEnabled && aiProvider !== 'none' && aiModel !== 'none' && aiModel.trim() !== '' ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                              telegramChatEnabled && aiProvider !== 'none' && aiModel !== 'none' && aiModel.trim() !== '' ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          </Tabs>

          <DialogFooter className="sm:justify-between gap-2 mt-4 shrink-0">
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
            {activeTab !== 'system-settings' ? (
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
            ) : (
              <Button
                type="submit"
                size="default"
                disabled={isUpdating || isLoadingSettings}
                className="text-xs font-semibold cursor-pointer shrink-0"
              >
                {isUpdating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving…
                  </span>
                ) : (
                  'Save Settings'
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
