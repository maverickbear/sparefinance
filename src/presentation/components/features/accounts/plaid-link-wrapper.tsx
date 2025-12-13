"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useToast } from "@/components/toast-provider";
import { Loader2 } from "lucide-react";

interface PlaidLinkWrapperProps {
  linkToken: string | null;
  onSuccess: (publicToken: string, metadata: any) => Promise<void>;
  onExit?: (err: any, metadata: any) => void;
  children: (props: { open: () => void; ready: boolean; loading: boolean }) => React.ReactNode;
}

export function PlaidLinkWrapper({
  linkToken,
  onSuccess,
  onExit,
  children,
}: PlaidLinkWrapperProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const onSuccessCallback = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        setLoading(true);
        await onSuccess(publicToken, metadata);
      } catch (error: any) {
        console.error("Error in Plaid Link success callback:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to connect bank account",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, toast]
  );

  const onExitCallback = useCallback(
    (err: any, metadata: any) => {
      // Check if error exists and has meaningful error information
      // Empty object {} means user cancelled (not an error)
      const hasErrorInfo = err && (
        err.error_message || 
        err.error_code || 
        err.error_type ||
        err.display_message
      );
      const isEmptyError = err && Object.keys(err).length === 0;
      
      if (hasErrorInfo && !isEmptyError) {
        // Real error - log and show toast
        console.error("Plaid Link error:", err);
        toast({
          title: "Connection error",
          description: err.display_message || err.error_message || "Bank connection failed",
          variant: "destructive",
        });
      } else if (isEmptyError) {
        // Empty error object means user cancelled - don't show error toast
        // Just silently handle the cancellation
        console.log("Plaid Link cancelled by user");
      }
      
      if (onExit) {
        onExit(err, metadata);
      }
    },
    [onExit, toast]
  );

  // usePlaidLink requires a valid config object, but token can be null
  // When token is null, ready will be false and open won't work
  const { open, ready, error: plaidError } = usePlaidLink({
    token: linkToken, // Can be null - hook will handle it
    onSuccess: onSuccessCallback,
    onExit: onExitCallback,
  });

  // Log errors for debugging (but only if we have a token - errors without token are expected)
  useEffect(() => {
    if (!plaidError) return; // No error, nothing to do
    
    // If error is empty object or has no meaningful error info, it's likely just initialization
    const hasErrorInfo = (plaidError as any).error_message || (plaidError as any).error_code || (plaidError as any).error_type;
    const isEmptyError = Object.keys(plaidError).length === 0;
    
    if (isEmptyError || !hasErrorInfo) {
      // Empty error object - this is expected during initialization when token is null
      if (!linkToken) {
        // Expected: no token yet, just log for debugging
        console.log('[PlaidLinkWrapper] Plaid Link initialization (no token yet, expected)');
      }
      return; // Don't show error for empty errors
    }
    
    // Only show error if we have a token and it's a real error
    if (linkToken) {
      const errorMessage = (plaidError as any).error_message || (plaidError as any).error_code || "An error occurred with Plaid Link";
      
      // Don't show error if it's just a missing/invalid token (expected during initialization)
      if ((plaidError as any).error_code !== 'INVALID_LINK_TOKEN' && 
          (plaidError as any).error_type !== 'INVALID_REQUEST' &&
          (plaidError as any).error_code !== 'ITEM_ERROR') {
        console.error('[PlaidLinkWrapper] Plaid Link error:', plaidError);
        toast({
          title: "Plaid Link Error",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        // Just log, don't show toast for expected initialization errors
        console.log('[PlaidLinkWrapper] Plaid Link initialization (expected):', (plaidError as any).error_code || (plaidError as any).error_type);
      }
    } else {
      // Error without token - this is expected, just log for debugging
      console.log('[PlaidLinkWrapper] Plaid Link error (no token yet, expected):', plaidError);
    }
  }, [plaidError, linkToken, toast]);

  // Return children with appropriate state
  // When token is null, ready will be false (expected)
  return (
    <>
      {children({
        open: (linkToken && ready ? open : (() => {
          if (!linkToken) {
            console.log('[PlaidLinkWrapper] Cannot open: no link token yet');
          } else if (!ready) {
            console.log('[PlaidLinkWrapper] Cannot open: not ready yet');
          }
        })) as () => void,
        ready: ready && !!linkToken && !loading,
        loading,
      })}
    </>
  );
}
