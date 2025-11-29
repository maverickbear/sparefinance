"use client";

import { useState, useEffect } from "react";

export function useAccountCheck() {
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function checkAccounts() {
    setIsChecking(true);
    try {
      const response = await fetch("/api/v2/accounts?includeHoldings=false");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const accounts = await response.json();
      setHasAccount(accounts.length > 0);
      return accounts.length > 0;
    } catch (error) {
      console.error("Error checking accounts:", error);
      setHasAccount(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    checkAccounts();
  }, []);

  return {
    hasAccount,
    isChecking,
    checkAccounts,
  };
}

