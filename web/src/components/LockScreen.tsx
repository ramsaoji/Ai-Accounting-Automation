import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { verifyAppLockPassword } from '../services/api';
import { toast } from 'sonner';
import { ShieldCheck, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';

interface LockScreenProps {
  onUnlock: (token: string) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    setHasError(false);

    try {
      const token = await verifyAppLockPassword(password);
      if (token) {
        toast.success("Welcome back! Terminal unlocked.");
        onUnlock(token);
      } else {
        setHasError(true);
        toast.error("Invalid passcode. Access denied.");
      }
    } catch (err) {
      toast.error("Server authorization request failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md select-none animate-in fade-in duration-300">
      <div className="w-full max-w-sm px-6 py-8 border rounded-2xl bg-card/60 shadow-lg text-center flex flex-col gap-6 mx-4">
        {/* Top Header Badge */}
        <div className="flex flex-col items-center gap-3">
          <div className={`size-14 rounded-full flex items-center justify-center border transition-all duration-300 ${
            hasError 
              ? 'bg-destructive/10 border-destructive/30 text-destructive animate-shake' 
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            {hasError ? <ShieldAlert className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold font-heading tracking-tight text-foreground">
              Accounting Terminal Locked
            </h1>
            <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
              Enter the administrative passcode to access the compliance command center.
            </p>
          </div>
        </div>

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Terminal Passcode
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setHasError(false);
                }}
                placeholder="Enter password..."
                className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                disabled={isVerifying}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!password.trim() || isVerifying}
            className="w-full text-xs font-semibold h-9 cursor-pointer"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Unlocking...
              </span>
            ) : 'Unlock Command Center'}
          </Button>
        </form>
      </div>
    </div>
  );
};
