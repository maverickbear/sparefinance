"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlaidLinkContext } from '@/components/banking/plaid-link-context';
import { usePlaidConnectionStatus } from '@/hooks/use-plaid-connection-status';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/toast-provider';
import { useSubscription } from '@/hooks/use-subscription';
import { Loader2, ChevronDown, Unlink } from 'lucide-react';
import { RemovePlaidDialog } from '@/components/accounts/remove-plaid-dialog';
import { AccountMappingDialog } from '@/components/accounts/account-mapping-dialog';

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
  const [removingIntegration, setRemovingIntegration] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [previewData, setPreviewData] = useState<{
    publicToken: string;
    metadata: any;
    itemId: string;
    accounts: any[];
    institutionName: string;
  } | null>(null);
  const { initialize, open, ready, isInitialized } = usePlaidLinkContext();
  
  // PERFORMANCE: Use shared hook to avoid duplicate API calls across multiple component instances
  const { connectionStatus, loading: loadingStatus, refresh: refreshConnectionStatus } = usePlaidConnectionStatus();

  const onSuccessCallback = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        setIsLoading(true);

        // First, preview accounts to show confirmation dialog
        console.log('[PLAID LINK] Previewing accounts...');
        const previewResponse = await fetch('/api/plaid/preview-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            metadata,
          }),
        });

        const previewData = await previewResponse.json();
        console.log('[PLAID LINK] Preview response:', {
          ok: previewResponse.ok,
          accountCount: previewData.accounts?.length,
          hasError: !!previewData.error,
        });

        if (!previewResponse.ok) {
          if (previewResponse.status === 403 && previewData.planError) {
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
          throw new Error(previewData.error || 'Failed to preview accounts');
        }

        // Store preview data and show mapping dialog
        console.log('[PLAID LINK] Showing mapping dialog:', {
          itemId: previewData.itemId,
          accountCount: previewData.accounts?.length,
          institution: previewData.institution?.name,
        });
        
        setPreviewData({
          publicToken, // Keep for reference but won't be used in final import
          metadata,
          itemId: previewData.itemId, // Store itemId to use in final import
          accounts: previewData.accounts,
          institutionName: previewData.institution?.name || 'Bank',
        });
        setShowMappingDialog(true);
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error previewing accounts:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to preview accounts',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    },
    [toast]
  );

  const handleConfirmImport = useCallback(
    async (accountMappings: Record<string, 'checking' | 'savings' | 'credit' | 'investment' | 'other'>) => {
      if (!previewData) {
        console.error('[PLAID LINK] No preview data available for import');
        return;
      }

      try {
        setIsLoading(true);
        setShowMappingDialog(false);

        console.log('[PLAID LINK] Confirming import:', {
          itemId: previewData.itemId,
          accountMappings,
          accountCount: Object.keys(accountMappings).length,
        });

        const response = await fetch('/api/plaid/exchange-public-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: previewData.itemId, // Use itemId from preview instead of publicToken
            accountTypeMappings: accountMappings,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to connect bank account');
        }

        // Show success message
        toast({
          title: 'Bank account connected',
          description: 'Your bank account has been connected successfully.',
          variant: 'success',
        });

        // Refresh connection status
        await refreshConnectionStatus();

        // Clear preview data on success
        setPreviewData(null);

        if (onSuccess) {
          onSuccess();
        }
      } catch (error: any) {
        console.error('[PLAID LINK] Error exchanging public token:', error);
        
        // Clean up preview data on error to prevent state inconsistency
        setPreviewData(null);
        
        toast({
          title: 'Error',
          description: error.message || 'Failed to connect bank account',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [previewData, toast, onSuccess, refreshConnectionStatus]
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

  const handleConnect = useCallback(async (accountType: 'bank' | 'investment' | 'both', country?: 'US' | 'CA') => {
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

  // Handle remove all Plaid integration
  const handleRemoveAll = useCallback(async () => {
    try {
      setRemovingIntegration(true);
      const response = await fetch('/api/plaid/disconnect-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove Plaid integration');
      }

      toast({
        title: 'Plaid integration removed',
        description: `Successfully disconnected ${data.accountsDisconnected} account${data.accountsDisconnected !== 1 ? 's' : ''} and removed ${data.connectionsRemoved} connection${data.connectionsRemoved !== 1 ? 's' : ''}.`,
        variant: 'success',
      });

      // Refresh connection status
      await refreshConnectionStatus();

      // Refresh accounts if callback provided
      if (onSuccess) {
        onSuccess();
      }

      setShowRemoveDialog(false);
    } catch (error: any) {
      console.error('Error removing Plaid integration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove Plaid integration',
        variant: 'destructive',
      });
    } finally {
      setRemovingIntegration(false);
    }
  }, [toast, refreshConnectionStatus, onSuccess]);

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
        <DropdownMenuContent align="end" className="min-w-[240px]">
          {/* Connection Status Section */}
          {connectionStatus?.hasConnections && (
            <>
              <div className="px-2 py-1.5">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Plaid Integration
                </DropdownMenuLabel>
              </div>
              <div className="px-2 py-1.5 space-y-1">
                <div className="text-xs text-muted-foreground">
                  {connectionStatus.connectionCount} connection{connectionStatus.connectionCount !== 1 ? 's' : ''} • {connectionStatus.accountCount} account{connectionStatus.accountCount !== 1 ? 's' : ''}
                </div>
                {connectionStatus.institutions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {connectionStatus.institutions.slice(0, 3).map((institution, index) => {
                      // Validate logo - must be a valid URL or data URL
                      const isValidLogo = institution.logo && (
                        institution.logo.startsWith('http://') ||
                        institution.logo.startsWith('https://') ||
                        institution.logo.startsWith('data:image/')
                      );
                      
                      return (
                        <div
                          key={`${institution.id}-${index}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs"
                        >
                          {isValidLogo && (
                            <img
                              src={institution.logo!}
                              alt={institution.name || 'Institution'}
                              className="h-3 w-3 rounded object-contain"
                              onError={(e) => {
                                // Hide image on error
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span className="truncate max-w-[80px]">
                            {institution.name || 'Unknown'}
                          </span>
                        </div>
                      );
                    })}
                    {connectionStatus.institutions.length > 3 && (
                      <div className="px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                        +{connectionStatus.institutions.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Connect Options */}
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
          <DropdownMenuItem
            onClick={() => handleConnect('both', 'CA')}
            disabled={isDisabled}
          >
            Both (Bank & Investment)
          </DropdownMenuItem>

          {/* Remove Integration Option */}
          {connectionStatus?.hasConnections && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowRemoveDialog(true)}
                disabled={isDisabled || removingIntegration}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Unlink className="mr-2 h-4 w-4" />
                Remove Plaid Integration
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Remove Plaid Dialog */}
      {connectionStatus?.hasConnections && (
        <RemovePlaidDialog
          open={showRemoveDialog}
          onOpenChange={setShowRemoveDialog}
          onConfirm={handleRemoveAll}
          connectionCount={connectionStatus.connectionCount}
          accountCount={connectionStatus.accountCount}
          institutions={connectionStatus.institutions}
          loading={removingIntegration}
        />
      )}

      {/* Account Mapping Dialog */}
      {previewData && (
        <AccountMappingDialog
          open={showMappingDialog}
          onOpenChange={async (open) => {
            setShowMappingDialog(open);
            if (!open) {
              // User cancelled - clean up orphaned connection
              // The connection was created in preview but no accounts were imported
              try {
                console.log('[PLAID LINK] User cancelled import, cleaning up orphaned connection:', previewData.itemId);
                await fetch('/api/plaid/cancel-preview', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    itemId: previewData.itemId,
                  }),
                });
              } catch (error) {
                console.error('[PLAID LINK] Error cleaning up orphaned connection:', error);
                // Don't show error to user - cleanup is best effort
              }
              setPreviewData(null);
              setIsLoading(false);
            }
          }}
          accounts={previewData.accounts}
          institutionName={previewData.institutionName}
          onConfirm={handleConfirmImport}
        />
      )}
    </>
  );
}

