"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentTransactionSchema, InvestmentTransactionFormData } from "@/src/domain/investments/investments.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { Loader2, Check, Sparkles } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { AccountRequiredDialog } from "@/components/common/account-required-dialog";
import { Label } from "@/components/ui/label";
import { parseDateInput, formatDateInput } from "@/src/infrastructure/utils/timestamp";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog as SecurityDialog,
  DialogContent as SecurityDialogContent,
  DialogDescription as SecurityDialogDescription,
  DialogFooter as SecurityDialogFooter,
  DialogHeader as SecurityDialogHeader,
  DialogTitle as SecurityDialogTitle,
} from "@/components/ui/dialog";

interface InvestmentTransaction {
  id: string;
  accountId: string;
  securityId: string | null;
  date: string;
  type: string;
  quantity: number | null;
  price: number | null;
  fees: number;
  notes: string | null;
  security?: {
    id: string;
    symbol: string;
    name: string;
    class: string;
  };
}

interface InvestmentTransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  transaction?: InvestmentTransaction | null;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
}

interface Security {
  id: string;
  symbol: string;
  name: string;
  class: string;
}

// Helper function to get logo URL for a security
function getSecurityLogo(symbol: string, securityClass: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  
  if (securityClass.toLowerCase() === "crypto") {
    return `https://cryptoicons.org/api/icon/${normalizedSymbol.toLowerCase()}/200`;
  }
  
  return `https://assets.polygon.io/logos/${normalizedSymbol}/logo.png`;
}

// Component for security logo with fallback
function SecurityLogo({ symbol, securityClass, logoUrl }: { symbol: string; securityClass: string; logoUrl?: string }) {
  const [logoError, setLogoError] = useState(false);
  
  if (logoError) {
    return (
      <span className="text-xs font-semibold text-muted-foreground">
        {symbol.charAt(0)}
      </span>
    );
  }
  
  const logo = logoUrl || getSecurityLogo(symbol, securityClass);
  
  return (
    <img 
      src={logo} 
      alt={symbol}
      className="h-full w-full object-cover"
      onError={() => setLogoError(true)}
    />
  );
}

export function InvestmentTransactionForm({ 
  open, 
  onOpenChange, 
  onSuccess,
  transaction: editingTransaction
}: InvestmentTransactionFormProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [securities, setSecurities] = useState<Security[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingSecurity, setIsCreatingSecurity] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [newSecurity, setNewSecurity] = useState({ symbol: "", name: "", class: "stock" });
  const [searchSymbol, setSearchSymbol] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedSecurity, setSearchedSecurity] = useState<{ symbol: string; name: string; class: string; price?: number } | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; class: string; exchange?: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [securitySearch, setSecuritySearch] = useState("");
  const [showSecurityDropdown, setShowSecurityDropdown] = useState(false);
  const [apiSearchResults, setApiSearchResults] = useState<Array<{ symbol: string; name: string; class: string; exchange?: string; logo?: string }>>([]);
  const [isSearchingSecurities, setIsSearchingSecurities] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);
  const [isExtractingInfo, setIsExtractingInfo] = useState(false);

  const form = useForm<InvestmentTransactionFormData & { currentPrice?: number; security?: { symbol: string; name: string; class: string } }>({
    resolver: zodResolver(investmentTransactionSchema),
    defaultValues: {
      date: new Date(),
      type: "buy",
      quantity: undefined,
      price: undefined,
      fees: 0,
      notes: "",
    },
  });

  const transactionType = form.watch("type");
  const securityId = form.watch("securityId");

  useEffect(() => {
    if (open) {
      // Check if there are accounts before showing the form
      checkAccountsAndShowForm();
    } else {
      // Reset state when dialog closes
      setShouldShowForm(false);
      setShowAccountDialog(false);
      setIsAddingAccount(false);
      setNewAccountName("");
      setShowSecurityDropdown(false);
      setSecuritySearch("");
      setApiSearchResults([]);
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (open && editingTransaction) {
      form.reset({
        date: new Date(editingTransaction.date),
        type: editingTransaction.type as "buy" | "sell" | "dividend" | "interest",
        accountId: editingTransaction.accountId,
        securityId: editingTransaction.securityId || undefined,
        quantity: editingTransaction.quantity || undefined,
        price: editingTransaction.price || undefined,
        fees: editingTransaction.fees || 0,
        notes: editingTransaction.notes || "",
      });
    } else if (open && !editingTransaction) {
      // Reset to defaults for new transaction
      form.reset({
        date: new Date(),
        type: "buy",
        quantity: undefined,
        price: undefined,
        fees: 0,
        notes: "",
        securityId: undefined,
      });
    }
  }, [open, editingTransaction, form]);

  async function checkAccountsAndShowForm() {
    try {
      const accountsRes = await fetch("/api/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        if (accountsData.length === 0) {
          // No accounts, show the dialog
          setShowAccountDialog(true);
          setShouldShowForm(false);
        } else {
          // Has accounts, can show the form
          setShouldShowForm(true);
          // Reset accounts to empty when dialog opens to show loading state
          setAccounts([]);
          setIsLoadingAccounts(true);
          loadData();
          form.reset({
            date: new Date(),
            type: "buy",
            quantity: undefined,
            price: undefined,
            fees: 0,
            notes: "",
            securityId: undefined,
          });
          setShowSecurityDropdown(false);
          setSecuritySearch("");
          setApiSearchResults([]);
        }
      } else {
        // Error fetching accounts, try to show the form anyway
        setShouldShowForm(true);
        setAccounts([]);
        setIsLoadingAccounts(true);
        loadData();
      }
    } catch (error) {
      console.error("Error checking accounts:", error);
      // In case of error, try to show the form anyway
      setShouldShowForm(true);
      setAccounts([]);
      setIsLoadingAccounts(true);
      loadData();
    }
  }

  async function loadData() {
    setIsLoadingAccounts(true);
    try {
      const [accountsRes, securitiesRes] = await Promise.all([
        fetch("/api/investments/accounts"),
        fetch("/api/investments/securities"),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        setAccounts(accountsData || []);
        if (!accountsData || accountsData.length === 0) {
          console.warn("No investment accounts found. Make sure you have created investment accounts.");
        }
      } else {
        const errorData = await accountsRes.json().catch(() => ({}));
        console.error("Error loading investment accounts:", errorData);
        toast({
          title: "Error",
          description: errorData.error || "Failed to load investment accounts",
          variant: "destructive",
        });
      }

      if (securitiesRes.ok) {
        const securitiesData = await securitiesRes.json().catch(() => []);
        setSecurities(securitiesData || []);
      } else {
        const errorData = await securitiesRes.json().catch(() => ({}));
        console.error("Error loading securities:", errorData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function checkAccountExists(name: string): Promise<boolean> {
    try {
      const res = await fetch("/api/investments/accounts");
      if (!res.ok) return false;
      
      const accounts = await res.json().catch(() => []);
      return accounts.some((acc: InvestmentAccount) => 
        acc.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
    } catch (error) {
      console.error("Error checking account existence:", error);
      return false;
    }
  }

  async function createAccountQuickly(name: string) {
    if (!name || !name.trim()) {
      return;
    }

    const trimmedName = name.trim();
    
    // Check if account already exists
    const exists = await checkAccountExists(trimmedName);
    if (exists) {
      toast({
        title: "Account already exists",
        description: `An account named "${trimmedName}" already exists.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreatingAccount(true);
    try {
      const res = await fetch("/api/investments/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create account");
      }

      const newAccount = await res.json();
      
      // Add the new account to the list immediately (optimistic update)
      setAccounts(prev => [...prev, newAccount]);
      
      // Select the newly created account
      form.setValue("accountId", newAccount.id);
      
      // Reset input mode
      setIsAddingAccount(false);
      setNewAccountName("");
      
      toast({
        title: "Success",
        description: `Account "${trimmedName}" created successfully`,
      });
      
      // Reload accounts list in background to ensure consistency
      loadData();
    } catch (error) {
      console.error("Error creating account:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleAccountInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      await createAccountQuickly(newAccountName);
    } else if (e.key === "Escape") {
      setIsAddingAccount(false);
      setNewAccountName("");
    }
  }

  async function handleAccountInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Use setTimeout to allow click events to process first
    setTimeout(async () => {
      // Check if focus moved to another element in the form
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.closest('form') || 
        activeElement.closest('[role="dialog"]') ||
        activeElement.tagName === 'BUTTON'
      )) {
        // If focus is still within the form/dialog, don't save yet
        // User might be clicking on another field
        return;
      }

      if (newAccountName.trim()) {
        await createAccountQuickly(newAccountName);
      } else {
        setIsAddingAccount(false);
        setNewAccountName("");
      }
    }, 150);
  }

  // Debounce search function for security dialog
  useEffect(() => {
    if (!searchSymbol || searchSymbol.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await handleSearchSecurities(searchSymbol.trim());
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchSymbol]);

  // Debounce search function for security selector
  useEffect(() => {
    if (!securitySearch || securitySearch.trim().length < 2) {
      setApiSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await handleSearchSecuritiesForSelector(securitySearch.trim());
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [securitySearch]);

  async function handleSearchSecurities(query: string) {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/investments/securities/search?query=${encodeURIComponent(query)}`);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to search");
      }

      const data = await res.json();
      setSearchResults(data.results || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Error searching securities:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearchSecuritiesForSelector(query: string) {
    if (!query || query.trim().length < 2) {
      setApiSearchResults([]);
      return;
    }

    setIsSearchingSecurities(true);
    try {
      const res = await fetch(`/api/investments/securities/search?query=${encodeURIComponent(query)}`);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to search");
      }

      const data = await res.json();
      setApiSearchResults(data.results || []);
    } catch (error) {
      console.error("Error searching securities:", error);
      setApiSearchResults([]);
    } finally {
      setIsSearchingSecurities(false);
    }
  }

  async function handleSelectSearchResult(result: { symbol: string; name: string; class: string }) {
    // Fetch detailed info for the selected result
    setIsSearching(true);
    try {
      const res = await fetch(`/api/investments/securities/search?symbol=${encodeURIComponent(result.symbol)}`);

      if (!res.ok) {
        throw new Error("Failed to fetch security details");
      }

      const securityInfo = await res.json();
      setSearchedSecurity({
        symbol: securityInfo.symbol,
        name: securityInfo.name,
        class: securityInfo.class,
        price: securityInfo.price,
      });
      
      // Pre-fill the form with searched security data
      setNewSecurity({
        symbol: securityInfo.symbol,
        name: securityInfo.name,
        class: securityInfo.class,
      });

      setSearchSymbol("");
      setSearchResults([]);
      setShowSearchResults(false);

      toast({
        title: "Success",
        description: `Selected: ${securityInfo.name} (${securityInfo.symbol})`,
      });
    } catch (error) {
      console.error("Error fetching security details:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch security details",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreateSecurity() {
    if (!newSecurity.symbol || !newSecurity.name) {
      toast({
        title: "Error",
        description: "Symbol and name are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingSecurity(true);
    try {
      const res = await fetch("/api/investments/securities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: newSecurity.symbol.toUpperCase(),
          name: newSecurity.name,
          class: newSecurity.class,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create security");
      }

      const security = await res.json();
      setSecurities([...securities, security]);
      form.setValue("securityId", security.id);
      setShowSecurityDialog(false);
      setNewSecurity({ symbol: "", name: "", class: "stock" });
      setSearchSymbol("");
      setSearchedSecurity(null);
      setShowSecurityDropdown(false);
      setSecuritySearch("");
      setApiSearchResults([]);
      toast({
        title: "Success",
        description: "Security created successfully",
      });
    } catch (error) {
      console.error("Error creating security:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create security",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSecurity(false);
    }
  }

  async function onSubmit(data: InvestmentTransactionFormData & { currentPrice?: number; security?: { symbol: string; name: string; class: string } }) {
    setIsSubmitting(true);
    try {
      const payload: any = {
        date: data.date,
        accountId: data.accountId,
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        fees: data.fees || 0,
        notes: data.notes,
      };

      if (data.securityId) {
        payload.securityId = data.securityId;
      } else if (data.security) {
        payload.security = data.security;
      }

      if (data.currentPrice) {
        payload.currentPrice = data.currentPrice;
      }

      const url = editingTransaction 
        ? `/api/investments/transactions/${editingTransaction.id}`
        : "/api/investments/transactions";
      const method = editingTransaction ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${editingTransaction ? "update" : "create"} transaction`);
      }

      toast({
        title: "Success",
        description: `Investment transaction ${editingTransaction ? "updated" : "created"} successfully`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create transaction",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function extractInfoFromNotes() {
    const notes = form.watch("notes");
    if (!notes || notes.trim().length === 0) {
      toast({
        title: "No description",
        description: "Please enter a description in the Notes field first",
        variant: "default",
      });
      return;
    }

    setIsExtractingInfo(true);
    try {
      const response = await fetch("/api/ai/extract-transaction-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: notes,
          transactionType: transactionType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract information");
      }

      const extractedInfo = await response.json();

      // Update form fields with extracted information
      let updatedFields = 0;
      
      if (extractedInfo.quantity !== null && extractedInfo.quantity !== undefined) {
        if (!form.watch("quantity") || form.watch("quantity") === 0) {
          form.setValue("quantity", extractedInfo.quantity);
          updatedFields++;
        }
      }

      if (extractedInfo.price !== null && extractedInfo.price !== undefined) {
        if (!form.watch("price") || form.watch("price") === 0) {
          form.setValue("price", extractedInfo.price);
          updatedFields++;
        }
      }

      if (extractedInfo.fees !== null && extractedInfo.fees !== undefined) {
        if (!form.watch("fees") || form.watch("fees") === 0) {
          form.setValue("fees", extractedInfo.fees);
          updatedFields++;
        }
      }

      if (extractedInfo.symbol) {
        // Try to find the security by symbol
        const matchingSecurity = securities.find(
          (s) => s.symbol.toUpperCase() === extractedInfo.symbol.toUpperCase()
        );
        if (matchingSecurity && !form.watch("securityId")) {
          form.setValue("securityId", matchingSecurity.id);
          updatedFields++;
        }
      }

      if (updatedFields > 0) {
        toast({
          title: "Information extracted",
          description: `Extracted and filled ${updatedFields} field${updatedFields > 1 ? "s" : ""} from the description`,
          variant: "success",
        });
      } else {
        toast({
          title: "No new information",
          description: "Could not extract additional information, or fields are already filled",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error extracting information:", error);
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "Failed to extract information from description",
        variant: "destructive",
      });
    } finally {
      setIsExtractingInfo(false);
    }
  }

  return (
    <>
      <AccountRequiredDialog
        open={showAccountDialog}
        onOpenChange={(isOpen) => {
          setShowAccountDialog(isOpen);
          if (!isOpen) {
            onOpenChange(false);
          }
        }}
        onAccountCreated={() => {
          setShowAccountDialog(false);
          checkAccountsAndShowForm();
        }}
      />
      {shouldShowForm && (
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? "Edit Investment Transaction" : "Add Investment Transaction"}
            </DialogTitle>
            <DialogDescription>
              {editingTransaction 
                ? "Update the details of this investment transaction"
                : "Record a buy, sell, dividend, or other investment transaction"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Account</Label>
                  {isAddingAccount ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAccount(false);
                        setNewAccountName("");
                      }}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingAccount(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Add new
                    </button>
                  )}
                </div>
                {isAddingAccount ? (
                  <div className="space-y-1">
                    <Input
                      type="text"
                      placeholder="Enter account name..."
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      onKeyDown={handleAccountInputKeyDown}
                      onBlur={handleAccountInputBlur}
                      disabled={isCreatingAccount}
                      autoFocus
                      className={isCreatingAccount ? "opacity-50" : ""}
                    />
                    {isCreatingAccount && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Creating account...
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Press Enter to save
                    </p>
                  </div>
                ) : (
                  <Select
                    value={form.watch("accountId") || ""}
                    onValueChange={(value) => form.setValue("accountId", value)}
                    disabled={isLoadingAccounts || accounts.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue 
                        placeholder={
                          isLoadingAccounts 
                            ? "Loading accounts..." 
                            : accounts.length === 0 
                            ? "No investment accounts available" 
                            : "Select account"
                        } 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingAccounts ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading accounts...
                        </div>
                      ) : accounts.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No investment accounts found
                        </div>
                      ) : (
                        accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {!isLoadingAccounts && accounts.length === 0 && !isAddingAccount && (
                  <p className="text-sm text-muted-foreground">
                    No investment accounts found. Click "Add new" to create one.
                  </p>
                )}
                {form.formState.errors.accountId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.accountId.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Transaction Type</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value: any) => form.setValue("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                      <SelectItem value="dividend">Dividend</SelectItem>
                      <SelectItem value="interest">Interest</SelectItem>
                      <SelectItem value="transfer_in">Transfer In</SelectItem>
                      <SelectItem value="transfer_out">Transfer Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Security</Label>
                    <button
                      type="button"
                      onClick={() => setShowSecurityDialog(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Add new
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search or select security..."
                      value={(() => {
                        const securityId = form.watch("securityId");
                        if (securityId && securities.length > 0) {
                          const security = securities.find((s) => s.id === securityId);
                          if (security && !showSecurityDropdown) {
                            return `${security.symbol} - ${security.name}`;
                          }
                        }
                        return securitySearch;
                      })()}
                      onChange={(e) => {
                        setSecuritySearch(e.target.value);
                        setShowSecurityDropdown(true);
                      }}
                      onFocus={() => {
                        setShowSecurityDropdown(true);
                      }}
                      onBlur={() => {
                        // Delay hiding to allow click on results
                        setTimeout(() => {
                          setShowSecurityDropdown(false);
                        }, 200);
                      }}
                      className="pr-8"
                    />
                    {isSearchingSecurities && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {form.watch("securityId") && !showSecurityDropdown && !isSearchingSecurities && (
                      <button
                        type="button"
                        onClick={() => {
                          form.setValue("securityId", undefined);
                          setSecuritySearch("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    )}
                    {showSecurityDropdown && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {(() => {
                          // Filter existing securities based on search
                          // If we have API results, don't filter - show all existing securities
                          // If we have search text but no API results yet, filter existing securities
                          // If no search text, show all securities
                          const filteredSecurities = securitySearch && securitySearch.length >= 2 && apiSearchResults.length === 0
                            ? securities.filter((security) =>
                                security.symbol.toLowerCase().includes(securitySearch.toLowerCase()) ||
                                security.name.toLowerCase().includes(securitySearch.toLowerCase()) ||
                                security.class.toLowerCase().includes(securitySearch.toLowerCase())
                              )
                            : securities;
                          
                          // Sort existing securities by symbol
                          const sortedSecurities = [...filteredSecurities].sort((a, b) =>
                            a.symbol.localeCompare(b.symbol)
                          );
                          
                          // Check if we have API results or existing securities
                          const hasApiResults = apiSearchResults.length > 0;
                          const hasExistingSecurities = sortedSecurities.length > 0;
                          
                          if (!hasApiResults && !hasExistingSecurities) {
                            if (isSearchingSecurities) {
                              return (
                                <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Searching...
                                </div>
                              );
                            }
                            return (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                {securities.length === 0 ? "No securities available." : "No security found."}
                              </div>
                            );
                          }
                          
                          return (
                            <>
                              {/* Show existing securities first */}
                              {sortedSecurities.map((security) => {
                                const isSelected = form.watch("securityId") === security.id;
                                return (
                                  <div
                                    key={security.id}
                                    className={cn(
                                      "px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground border-b",
                                      isSelected && "bg-accent"
                                    )}
                                    onClick={() => {
                                      form.setValue("securityId", security.id);
                                      setShowSecurityDropdown(false);
                                      setSecuritySearch("");
                                      setApiSearchResults([]);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Check
                                        className={cn(
                                          "h-4 w-4 shrink-0",
                                          isSelected ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                        <SecurityLogo symbol={security.symbol} securityClass={security.class} />
                                      </div>
                                      <div className="flex flex-col flex-1">
                                        <span className="font-medium">{security.symbol} - {security.name}</span>
                                        <span className="text-xs text-muted-foreground">{security.class.toUpperCase()}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Show API search results */}
                              {hasApiResults && (
                                <>
                                  {sortedSecurities.length > 0 && (
                                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/50">
                                      Search Results
                                    </div>
                                  )}
                                  {apiSearchResults.map((result, index) => {
                                    // Check if this result already exists in our securities
                                    const existingSecurity = securities.find(
                                      (s) => s.symbol.toLowerCase() === result.symbol.toLowerCase()
                                    );
                                    
                                    if (existingSecurity) {
                                      // If it exists, show it in the existing securities section (already shown above)
                                      return null;
                                    }
                                    
                                    return (
                                      <div
                                        key={`api-${result.symbol}-${index}`}
                                        className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                                        onClick={async () => {
                                          // Check if security already exists
                                          const existing = securities.find(
                                            (s) => s.symbol.toLowerCase() === result.symbol.toLowerCase()
                                          );
                                          
                                          if (existing) {
                                            form.setValue("securityId", existing.id);
                                          } else {
                                            // Create the security automatically
                                            try {
                                              const res = await fetch("/api/investments/securities", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                  symbol: result.symbol.toUpperCase(),
                                                  name: result.name,
                                                  class: result.class,
                                                }),
                                              });
                                              
                                              if (res.ok) {
                                                const newSecurity = await res.json();
                                                setSecurities([...securities, newSecurity]);
                                                form.setValue("securityId", newSecurity.id);
                                                toast({
                                                  title: "Success",
                                                  description: `Security "${result.name}" created and selected`,
                                                });
                                              } else {
                                                throw new Error("Failed to create security");
                                              }
                                            } catch (error) {
                                              console.error("Error creating security:", error);
                                              toast({
                                                title: "Error",
                                                description: "Failed to create security. Please try again.",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                          }
                                          
                                          setShowSecurityDropdown(false);
                                          setSecuritySearch("");
                                          setApiSearchResults([]);
                                        }}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                            <SecurityLogo symbol={result.symbol} securityClass={result.class} logoUrl={result.logo} />
                                          </div>
                                          <div className="flex flex-col flex-1">
                                            <span className="font-medium">{result.symbol} - {result.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {result.class.toUpperCase()}
                                              {result.exchange && ` • ${result.exchange}`}
                                            </span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">New</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(transactionType === "buy" || transactionType === "sell") && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="0.0000"
                        {...form.register("quantity", { valueAsNumber: true })}
                      />
                      {form.formState.errors.quantity && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.quantity.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label>Price per Share</Label>
                      <DollarAmountInput
                        value={form.watch("price") || undefined}
                        onChange={(value) => form.setValue("price", value)}
                      />
                      {form.formState.errors.price && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.price.message}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label>Fees</Label>
                <DollarAmountInput
                  value={form.watch("fees") || undefined}
                  onChange={(value) => form.setValue("fees", value ?? 0)}
                />
              </div>

              {form.watch("securityId") && (
                <div className="space-y-1">
                  <Label>Current Price (Optional)</Label>
                  <DollarAmountInput
                    value={form.watch("currentPrice") || undefined}
                    onChange={(value) => form.setValue("currentPrice", value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Update the current market price for this security
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label>Date</Label>
                <DatePicker
                  date={(() => {
                    const dateValue = form.watch("date");
                    if (!dateValue) return undefined;
                    if (typeof dateValue === 'string') return new Date(dateValue);
                    if (dateValue instanceof Date) return dateValue;
                    return undefined;
                  })()}
                  onDateChange={(date) => {
                    form.setValue("date", date || new Date());
                  }}
                  placeholder="Select date"
                />
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.date.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Notes</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    onClick={extractInfoFromNotes}
                    disabled={isExtractingInfo || !form.watch("notes") || form.watch("notes")?.trim().length === 0}
                    className="h-7 text-xs"
                  >
                    {isExtractingInfo ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Extract Info
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  placeholder="Additional notes... (Use AI to extract quantity, price, fees, and symbol)"
                  {...form.register("notes")}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Write a description and click "Extract Info" to automatically fill fields like quantity, price, fees, and symbol.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Transaction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      <SecurityDialog open={showSecurityDialog} onOpenChange={(open) => {
        setShowSecurityDialog(open);
        if (!open) {
          setSearchSymbol("");
          setSearchedSecurity(null);
          setNewSecurity({ symbol: "", name: "", class: "stock" });
          setSearchResults([]);
          setShowSearchResults(false);
        }
      }}>
        <SecurityDialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
          <SecurityDialogHeader>
            <SecurityDialogTitle>Create New Security</SecurityDialogTitle>
            <SecurityDialogDescription>
              Search for a security by symbol or create manually
            </SecurityDialogDescription>
          </SecurityDialogHeader>
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="space-y-2">
              <Label>Search by Name or Symbol</Label>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={searchSymbol}
                      onChange={(e) => {
                        setSearchSymbol(e.target.value);
                        setShowSearchResults(true);
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) {
                          setShowSearchResults(true);
                        }
                      }}
                      onBlur={() => {
                        // Delay hiding to allow click on results
                        setTimeout(() => {
                          setShowSearchResults(false);
                        }, 200);
                      }}
                      placeholder="Apple, AAPL, Bitcoin, BTC..."
                      className="pr-8"
                    />
                    {isSearching && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                {showSearchResults && searchResults.length > 0 && (
                  <div 
                    className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking on results
                  >
                    {searchResults.map((result, index) => (
                      <div
                        key={`${result.symbol}-${index}`}
                        className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                        onClick={() => handleSelectSearchResult(result)}
                      >
                        <div className="font-medium">{result.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.symbol} • {result.class.toUpperCase()}
                          {result.exchange && ` • ${result.exchange}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showSearchResults && searchSymbol.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                    No results found
                  </div>
                )}
              </div>
              {searchedSecurity && (
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="font-semibold">{searchedSecurity.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Symbol: {searchedSecurity.symbol} | Type: {searchedSecurity.class.toUpperCase()}
                  </div>
                  {searchedSecurity.price && (
                    <div className="text-sm font-medium">
                      Current Price: ${searchedSecurity.price.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Symbol</Label>
              <Input
                value={newSecurity.symbol}
                onChange={(e) => setNewSecurity({ ...newSecurity, symbol: e.target.value.toUpperCase() })}
                placeholder="AAPL"
              />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={newSecurity.name}
                onChange={(e) => setNewSecurity({ ...newSecurity, name: e.target.value })}
                placeholder="Apple Inc."
              />
            </div>
            <div className="space-y-1">
              <Label>Class</Label>
              <Select
                value={newSecurity.class}
                onValueChange={(value) => setNewSecurity({ ...newSecurity, class: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="bond">Bond</SelectItem>
                  <SelectItem value="reit">REIT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          </div>
          <SecurityDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowSecurityDialog(false);
                setSearchSymbol("");
                setSearchedSecurity(null);
                setNewSecurity({ symbol: "", name: "", class: "stock" });
              }}
              disabled={isCreatingSecurity}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateSecurity}
              disabled={isCreatingSecurity}
            >
              {isCreatingSecurity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </SecurityDialogFooter>
        </SecurityDialogContent>
      </SecurityDialog>
    </>
  );
}

