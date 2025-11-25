"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlaidLinkContext } from '@/components/banking/plaid-link-context';
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
  defaultCountry?: 'US' | 'CA'; // Default country for bank connections (now defaults to CA)
}

export function ConnectBankButton({ onSuccess, variant = "default", defaultCountry = 'CA' }: ConnectBankButtonProps) {
  const { toast } = useToast();
  const { limits, plan, checking: limitsLoading } = useSubscription();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { initialize, open, ready, isInitialized } = usePlaidLinkContext();

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

  const onErrorCallback = useCallback(
    (error: any, metadata: any) => {
      setIsLoading(false);
      console.error('[PLAID LINK] Error during Link flow:', {
        error_code: error?.error_code,
        error_type: error?.error_type,
        error_message: error?.error_message,
        display_message: error?.display_message,
        metadata,
      });

      // Handle specific error types with user-friendly messages
      const errorCode = error?.error_code;
      const errorType = error?.error_type;

      if (errorCode === 'INTERNAL_SERVER_ERROR' || errorType === 'API_ERROR') {
        // INTERNAL_SERVER_ERROR is often temporary - suggest retry
        toast({
          title: 'Connection Error',
          description: 'An unexpected error occurred while connecting. This is usually temporary. Please try again in a few moments.',
          variant: 'destructive',
        });
      } else if (errorCode === 'INSTITUTION_NOT_RESPONDING' || errorCode === 'INSTITUTION_DOWN') {
        toast({
          title: 'Bank Temporarily Unavailable',
          description: 'Your bank is currently not responding. Please try again later.',
          variant: 'destructive',
        });
      } else if (errorCode === 'ITEM_LOGIN_REQUIRED') {
        toast({
          title: 'Login Required',
          description: 'Please reconnect your account. Your credentials may have expired.',
          variant: 'destructive',
        });
      } else {
        // Generic error message
        toast({
          title: 'Connection Error',
          description: error?.display_message || error?.error_message || 'An error occurred while connecting. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Handle Plaid Link exit
  const handlePlaidExit = useCallback((err: any, metadata: any) => {
    setIsLoading(false);
    // Reset link token after exit
    setLinkToken(null);
    // onExit is called when user closes Link, not necessarily an error
    // Only show error if there's actually an error object
    if (err) {
      console.error('[PLAID LINK] Exit with error:', err);
      // Don't show toast here if onError already handled it
      // onError fires before onExit for actual errors
      if (!err.error_code && !err.error_type) {
        // This is likely a user cancellation, not a Plaid error
        toast({
          title: 'Connection cancelled',
          description: err.display_message || 'The connection was cancelled.',
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const handleConnect = useCallback(async (accountType: 'bank' | 'investment', country?: 'US' | 'CA') => {
    try {
      setIsLoading(true);

      // Use provided country or default country
      const countryToUse = country || defaultCountry;

      // Fetch link token with account type and country
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountType,
          country: countryToUse,
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
          setIsLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to create link token');
      }

      // Set link token
      setLinkToken(data.link_token);
      
      // Initialize or update Plaid Link through context
      // The context ensures only one instance exists globally
      // Note: onError is not supported in react-plaid-link v4
      // Errors are handled through onExit callback
      initialize({
        token: data.link_token,
        onSuccess: onSuccessCallback,
        onExit: (err, metadata) => {
          // Handle errors through onExit (err will be non-null if there's an error)
          if (err) {
            onErrorCallback(err, metadata);
          }
          handlePlaidExit(err, metadata);
        },
      });
    } catch (error: any) {
      console.error('Error creating link token:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect account',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [toast, defaultCountry, initialize, isInitialized, onSuccessCallback, onErrorCallback, handlePlaidExit]);


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

  // Open Plaid Link when token is ready and Plaid Link is initialized
  useEffect(() => {
    if (linkToken && ready && open && isInitialized) {
      // Small delay to ensure Plaid Link is fully ready
      const timeout = setTimeout(() => {
        if (open) {
          open();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [linkToken, ready, open, isInitialized]);

  return (
    <>
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
            onClick={() => handleConnect('bank', 'CA')}
            disabled={isDisabled}
          >
            Bank Account
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleConnect('investment', 'CA')}
            disabled={isDisabled}
          >
            Investment Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

