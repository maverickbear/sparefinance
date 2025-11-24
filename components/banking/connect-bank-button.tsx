"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/toast-provider';
import { useSubscription } from '@/hooks/use-subscription';
import { Loader2, ChevronDown } from 'lucide-react';

interface ConnectBankButtonProps {
  onSuccess?: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function ConnectBankButton({ onSuccess, variant = "default" }: ConnectBankButtonProps) {
  const { toast } = useToast();
  const { limits, plan, checking: limitsLoading } = useSubscription();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const openPlaidRef = useRef<(() => void) | null>(null);

  const onSuccessCallback = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        setIsLoading(true);

        const response = await fetch('/api/plaid/exchange-public-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            metadata,
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
          description: 'Your bank account has been connected successfully.',
          variant: 'success',
        });

        if (onSuccess) {
          onSuccess();
        }
      } catch (error: any) {
        console.error('Error exchanging public token:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to connect bank account',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onSuccessCallback,
    onExit: (err: any, metadata: any) => {
      setIsLoading(false);
      if (err) {
        console.error('Plaid Link error:', err);
        toast({
          title: 'Connection cancelled',
          description: err.display_message || 'The connection was cancelled.',
          variant: 'destructive',
        });
      }
    },
  });

  // Store open function in ref so we can call it from handleConnect
  useEffect(() => {
    openPlaidRef.current = open as () => void;
  }, [open]);

  // Open Plaid Link when link token is ready
  useEffect(() => {
    if (linkToken && ready && openPlaidRef.current) {
      openPlaidRef.current();
    }
  }, [linkToken, ready]);

  const handleConnect = useCallback(async (accountType: 'bank' | 'investment') => {
    try {
      setIsLoading(true);

      // Fetch link token with account type
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType }),
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
          setIsLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to create link token');
      }

      // Set link token - useEffect will handle opening Plaid Link when ready
      setLinkToken(data.link_token);
    } catch (error: any) {
      console.error('Error creating link token:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect account',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [toast]);


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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isDisabled}
          variant={variant}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              Connect Account
              <ChevronDown className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleConnect('bank')}
          disabled={isDisabled}
        >
          Bank Account
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleConnect('investment')}
          disabled={isDisabled}
        >
          Investment Account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

