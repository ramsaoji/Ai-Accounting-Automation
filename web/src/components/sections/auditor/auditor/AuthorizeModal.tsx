import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Alert } from '@/types';

interface AuthorizeModalProps {
  activeActionModal: Alert;
  onClose: () => void;
  onAuthorizeApproved: (secondarySigner: string) => void;
}

export const AuthorizeModal: React.FC<AuthorizeModalProps> = ({
  activeActionModal,
  onClose,
  onAuthorizeApproved
}) => {
  const [passcode, setPasscode] = useState('');
  const [primarySigner] = useState('Senior Bookkeeper');
  const [secondarySigner, setSecondarySigner] = useState('General Manager');
  const [authErrors, setAuthErrors] = useState<{
    secondarySigner?: string;
    passcode?: string;
  }>({});

  const handleAuthorizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof authErrors = {};

    if (!secondarySigner.trim()) {
      newErrors.secondarySigner = 'Please enter the name of the Authorizing Manager.';
    }
    if (!passcode.trim()) {
      newErrors.passcode = 'Please enter a valid secondary authorization PIN.';
    }

    if (Object.keys(newErrors).length > 0) {
      setAuthErrors(newErrors);
      return;
    }

    setAuthErrors({});
    onAuthorizeApproved(secondarySigner);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="bg-card border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-border/80 flex flex-col gap-1 bg-muted/15 relative">
          <h3 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Dual-Authorization Approval
          </h3>
          <p className="text-[0.7rem] text-muted-foreground leading-normal">
            Enforcing internal safety controls: anomalous category expense transactions require verification and secondary sign-off before clearance.
          </p>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleAuthorizeSubmit} noValidate className="p-6 flex flex-col gap-5">
          {/* Flagged Item Details */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-muted/30">
            <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-widest">Flagged Ledger Exception</span>
            <span className="text-[0.68rem] text-foreground font-semibold leading-relaxed mt-0.5">
              {activeActionModal.message}
            </span>
          </div>

          {/* Roles Flow */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="primary-signer" className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">Primary Signer</label>
              <input
                id="primary-signer"
                type="text"
                value={primarySigner}
                aria-label="Primary Signer (Senior Accountant)"
                className="h-10 sm:h-8 border rounded-lg px-2 text-[0.68rem] font-medium bg-muted/40 cursor-not-allowed select-none text-foreground"
                disabled
              />
              <span className="text-[0.55rem] text-muted-foreground mt-0.5">Senior Accountant</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <label htmlFor="secondary-signer" className={`text-[0.58rem] font-bold uppercase tracking-wider ${authErrors.secondarySigner ? 'text-destructive' : 'text-muted-foreground'}`}>Secondary Signer</label>
              <input
                id="secondary-signer"
                type="text"
                value={secondarySigner}
                onChange={(e) => {
                  setSecondarySigner(e.target.value);
                  if (authErrors.secondarySigner) {
                    setAuthErrors(prev => ({ ...prev, secondarySigner: undefined }));
                  }
                }}
                aria-label="Secondary Signer (Authorizing Manager)"
                className={`h-10 sm:h-8 border rounded-lg px-2 text-[0.68rem] font-medium bg-background text-foreground transition-all focus:outline-none focus:ring-1 ${
                  authErrors.secondarySigner
                    ? 'border-destructive focus:ring-destructive focus:border-destructive'
                    : 'border-border focus:ring-primary focus:border-primary'
                }`}
              />
              {authErrors.secondarySigner ? (
                <span className="text-[10px] text-destructive font-semibold mt-1">
                  {authErrors.secondarySigner}
                </span>
              ) : (
                <span className="text-[0.55rem] text-muted-foreground mt-0.5">Authorizing Manager</span>
              )}
            </div>
          </div>

          {/* PIN / Code Input */}
          <div className="flex flex-col gap-1">
            <label htmlFor="manager-pin" className={`text-[0.58rem] font-bold uppercase tracking-wider ${authErrors.passcode ? 'text-destructive' : 'text-muted-foreground'}`}>Manager Authorization PIN</label>
            <input
              id="manager-pin"
              type="password"
              placeholder="Enter 4-digit security PIN (e.g. 1234)"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (authErrors.passcode) {
                  setAuthErrors(prev => ({ ...prev, passcode: undefined }));
                }
              }}
              aria-label="Manager Authorization PIN"
              className={`h-10 sm:h-9.5 border rounded-lg px-3 text-xs bg-background text-foreground transition-all focus:outline-none focus:ring-1 ${
                authErrors.passcode
                  ? 'border-destructive focus:ring-destructive focus:border-destructive'
                  : 'border-border focus:ring-primary focus:border-primary'
              }`}
            />
            {authErrors.passcode && (
              <span className="text-[10px] text-destructive font-semibold mt-1">
                {authErrors.passcode}
              </span>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 border-t pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onClose}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="default"
              className="text-xs font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="size-4" />
              Authorize & Approve
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
