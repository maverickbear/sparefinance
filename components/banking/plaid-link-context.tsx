"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';

interface PlaidLinkContextType {
  initialize: (config: PlaidLinkOptions) => void;
  open: (() => void) | null;
  ready: boolean;
  isInitialized: boolean;
}

const PlaidLinkContext = createContext<PlaidLinkContextType | null>(null);

/**
 * Provider to ensure Plaid Link is only initialized once across the entire app
 * This prevents the "script embedded more than once" warning
 */
export function PlaidLinkProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PlaidLinkOptions>({
    token: null,
    onSuccess: () => {},
    onExit: () => {},
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const { open, ready } = usePlaidLink(config);

  const initialize = useCallback((newConfig: PlaidLinkOptions) => {
    // Update config even if already initialized (allows re-initialization with new token)
    setConfig(newConfig);
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const value: PlaidLinkContextType = {
    initialize,
    open: open ? (() => open()) : null,
    ready,
    isInitialized,
  };

  return (
    <PlaidLinkContext.Provider value={value}>
      {children}
    </PlaidLinkContext.Provider>
  );
}

export function usePlaidLinkContext() {
  const context = useContext(PlaidLinkContext);
  if (!context) {
    // Return a no-op implementation if context is not available
    // This allows the component to work without the provider (graceful degradation)
    return {
      initialize: () => {},
      open: null,
      ready: false,
      isInitialized: false,
    };
  }
  return context;
}

