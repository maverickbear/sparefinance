"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
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
            metadata: {
              institution: metadata.institution,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to connect bank account');
        }

        // Show sync results if available
        const totalSynced = data.syncResults?.reduce((sum: number, result: any) => sum + (result.synced || 0), 0) || 0;
        const totalSkipped = data.syncResults?.reduce((sum: number, result: any) => sum + (result.skipped || 0), 0) || 0;
        
        if (totalSynced > 0) {
          toast({
            title: 'Bank account connected',
            description: `Your bank account has been connected and ${totalSynced} transaction${totalSynced > 1 ? 's' : ''} ${totalSynced > 1 ? 'have' : 'has'} been imported.`,
            variant: 'success',
          });
        } else {
          toast({
            title: 'Bank account connected',
            description: 'Your bank account has been connected successfully. Transactions will be synced automatically.',
            variant: 'success',
          });
        }

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
    },
    [toast, onSuccess]
  );

  // Log token changes
  useEffect(() => {
    console.log('[ConnectBankButton] Link token changed:', {
      hasToken: !!linkToken,
      tokenLength: linkToken?.length || 0,
    });
  }, [linkToken]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onSuccessCallback,
    onExit: (err: any, metadata: any) => {
      if (err) {
        console.error('Plaid Link error:', err);
        toast({
          title: 'Connection cancelled',
          description: err.display_message || 'The connection was cancelled.',
          variant: 'destructive',
        });
      }
      // Reset link token when user exits
      setLinkToken(null);
    },
  });

  // Store open function in ref
  useEffect(() => {
    openPlaidRef.current = open as () => void;
    console.log('[ConnectBankButton] Open function updated:', {
      hasOpen: !!open,
      ready,
    });
  }, [open, ready]);

  const handleConnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.planError) {
          // Plan error - will be handled by FeatureGuard
          toast({
            title: 'Upgrade Required',
            description: 'Bank integration is only available for Basic and Premium plans.',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(data.error || 'Failed to create link token');
      }

      if (!data.link_token) {
        throw new Error('No link token received from server');
      }

      console.log('[ConnectBankButton] Link token received, setting state...');
      setLinkToken(data.link_token);
    } catch (error: any) {
      console.error('Error creating link token:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create link token. Please check your Plaid configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Auto-open Plaid Link when token is set and ready
  useEffect(() => {
    console.log('[ConnectBankButton] useEffect triggered:', {
      hasToken: !!linkToken,
      ready,
      hasOpen: !!open,
    });

    if (!linkToken) {
      return;
    }

    if (ready) {
      console.log('[ConnectBankButton] Ready is true, opening Plaid Link immediately...');
      try {
        open();
        // Don't reset linkToken immediately - let onExit handle it
        // This ensures the modal stays open
      } catch (error) {
        console.error('[ConnectBankButton] Error opening Plaid Link:', error);
        toast({
          title: 'Error',
          description: 'Failed to open Plaid Link. Please try again.',
          variant: 'destructive',
        });
        setLinkToken(null);
      }
      return;
    }

    // If not ready yet, wait a bit and try to open anyway
    console.log('[ConnectBankButton] Not ready yet, setting timeout...');
    const timeout = setTimeout(() => {
      console.log('[ConnectBankButton] Timeout fired - attempting to open Plaid Link...');
      console.log('[ConnectBankButton] Timeout state:', {
        hasToken: !!linkToken,
        ready,
        hasOpenRef: !!openPlaidRef.current,
      });
      
      if (linkToken && openPlaidRef.current) {
        try {
          console.log('[ConnectBankButton] Calling open() via ref...');
          openPlaidRef.current();
          // Don't reset linkToken immediately - let onExit handle it
        } catch (error) {
          console.error('[ConnectBankButton] Error opening Plaid Link after timeout:', error);
          toast({
            title: 'Error',
            description: 'Failed to open Plaid Link. Please try again.',
            variant: 'destructive',
          });
          setLinkToken(null);
        }
      } else {
        console.error('[ConnectBankButton] Cannot open - missing token or open function');
        toast({
          title: 'Error',
          description: 'Plaid Link failed to initialize. Please refresh and try again.',
          variant: 'destructive',
        });
        setLinkToken(null);
      }
    }, 2000); // Wait 2 seconds

    return () => {
      console.log('[ConnectBankButton] Cleaning up timeout...');
      clearTimeout(timeout);
    };
  }, [linkToken, ready, open, toast]);


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
  // Don't disable based on ready state when there's no token
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
      ) : linkToken && !ready ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Initializing...
        </>
      ) : (
        'Connect Bank Account'
      )}
    </Button>
  );
}

