"use client";

import { useState, useCallback } from 'react';
// import { usePlaidLink } from 'react-plaid-link'; // TEMPORARILY DISABLED
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';
import { Loader2 } from 'lucide-react';

interface ConnectBankButtonProps {
  onSuccess?: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function ConnectBankButton({ onSuccess, variant = "default" }: ConnectBankButtonProps) {
  const { toast } = useToast();
  const { limits, loading: limitsLoading } = usePlanLimits();
  const [isLoading, setIsLoading] = useState(false);

  // TEMPORARY BYPASS: Simulate bank connection without using Plaid Link
  const handleConnect = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[PLAID BYPASS] Simulating bank connection...');

      // Simulate a delay to mimic the connection process
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Call the exchange endpoint with mock data
      const mockPublicToken = `public-bypass-${Date.now()}`;
      const mockMetadata = {
        institution: {
          institution_id: 'ins_bypass',
          name: 'Mock Bank',
        },
      };

      const response = await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken: mockPublicToken,
          metadata: mockMetadata,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.planError) {
          toast({
            title: 'Upgrade Required',
            description: 'Bank integration is only available for Basic and Premium plans.',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(data.error || 'Failed to connect bank account');
      }

      // Show success message
      toast({
        title: 'Bank account connected',
        description: 'Your bank account has been connected successfully (bypass mode).',
        variant: 'success',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error connecting bank account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect bank account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, onSuccess]);

  // Original implementation with Plaid Link (commented out):
  // const [linkToken, setLinkToken] = useState<string | null>(null);
  // const openPlaidRef = useRef<(() => void) | null>(null);

  // const onSuccessCallback = useCallback(
  //   async (publicToken: string, metadata: any) => {
  //     // ... original implementation
  //   },
  //   [toast, onSuccess]
  // );

  // const { open, ready } = usePlaidLink({
  //   token: linkToken,
  //   onSuccess: onSuccessCallback,
  //   onExit: (err: any, metadata: any) => {
  //     // ... original implementation
  //   },
  // });

  // const handleConnect = useCallback(async () => {
  //   // ... original implementation
  // }, [toast]);


  if (limitsLoading) {
    return (
      <Button disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!limits.hasBankIntegration) {
    return (
      <UpgradePrompt
        feature="Bank Integration"
        requiredPlan="basic"
        currentPlan="free"
      />
    );
  }

  // Only disable if loading
  const isDisabled = isLoading;

  return (
    <Button
      onClick={handleConnect}
      disabled={isDisabled}
      variant={variant}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        'Connect Bank Account (Bypass)'
      )}
    </Button>
  );
}

