"use client";

import { useState, useEffect } from "react";
import { getAccountsClient } from "@/lib/api/accounts-client";

export function useAccountCheck() {
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function checkAccounts() {
    setIsChecking(true);
    try {
      const accounts = await getAccountsClient();
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

