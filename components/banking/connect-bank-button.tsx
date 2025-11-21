"use client";

import { useState, useCallback } from 'react';
// import { usePlaidLink } from 'react-plaid-link'; // TEMPORARILY DISABLED
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useSubscription } from '@/hooks/use-subscription';
import { Loader2 } from 'lucide-react';

interface ConnectBankButtonProps {
  onSuccess?: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function ConnectBankButton({ onSuccess, variant = "default" }: ConnectBankButtonProps) {
  const { toast } = useToast();
  const { limits, plan, checking: limitsLoading } = useSubscription();
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
          // Fetch plan names dynamically
          fetch("/api/billing/plans/public")
            .then(res => res.json())
            .then(plansData => {
              if (plansData.plans) {
                const essentialPlan = plansData.plans.find((p: { id: string }) => p.id === 'essential');
                const proPlan = plansData.plans.find((p: { id: string }) => p.id === 'pro');
                const essentialPlanName = essentialPlan?.name || 'Essential';
                const proPlanName = proPlan?.name || 'Pro';
                toast({
                  title: 'Upgrade Required',
                  description: `Bank integration is only available for ${essentialPlanName} and ${proPlanName} plans.`,
                  variant: 'destructive',
                });
              } else {
                toast({
                  title: 'Upgrade Required',
                  description: 'Bank integration is only available for paid plans.',
                  variant: 'destructive',
                });
              }
            })
            .catch(() => {
              toast({
                title: 'Upgrade Required',
                description: 'Bank integration is only available for paid plans.',
                variant: 'destructive',
              });
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

  // Check if user has access to bank integration
  // The database is the source of truth - if a feature is disabled in Supabase, it should be disabled here
  // Safety check: convert string "true" to boolean (defensive programming)
  const hasAccess = limits.hasBankIntegration === true || String(limits.hasBankIntegration) === "true";
  
  if (!hasAccess) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Bank integration is not available in your current plan.
      </div>
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

