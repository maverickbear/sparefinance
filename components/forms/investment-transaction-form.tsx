"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentTransactionSchema, InvestmentTransactionFormData } from "@/lib/validations/investment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Plus, Search } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog as SecurityDialog,
  DialogContent as SecurityDialogContent,
  DialogDescription as SecurityDialogDescription,
  DialogFooter as SecurityDialogFooter,
  DialogHeader as SecurityDialogHeader,
  DialogTitle as SecurityDialogTitle,
} from "@/components/ui/dialog";

interface InvestmentTransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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

export function InvestmentTransactionForm({ 
  open, 
  onOpenChange, 
  onSuccess 
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
    }
  }, [open]);

  async function loadData() {
    try {
      const [accountsRes, securitiesRes] = await Promise.all([
        fetch("/api/investments/accounts"),
        fetch("/api/investments/securities"),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        setAccounts(accountsData);
      }

      if (securitiesRes.ok) {
        const securitiesData = await securitiesRes.json().catch(() => []);
        setSecurities(securitiesData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  // Debounce search function
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

      const res = await fetch("/api/investments/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create transaction");
      }

      toast({
        title: "Success",
        description: "Investment transaction created successfully",
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
          <DialogHeader>
            <DialogTitle>Add Investment Transaction</DialogTitle>
            <DialogDescription>
              Record a buy, sell, dividend, or other investment transaction
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="space-y-1">
                <Label>Account</Label>
                <Select
                  value={form.watch("accountId") || ""}
                  onValueChange={(value) => form.setValue("accountId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.accountId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.accountId.message}
                  </p>
                )}
              </div>

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
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    onClick={() => setShowSecurityDialog(true)}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </div>
                <Select
                  value={form.watch("securityId") || ""}
                  onValueChange={(value) => form.setValue("securityId", value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or create security" />
                  </SelectTrigger>
                  <SelectContent>
                    {securities.map((security) => (
                      <SelectItem key={security.id} value={security.id}>
                        {security.symbol} - {security.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!form.watch("securityId") && (transactionType === "buy" || transactionType === "sell") && (
                  <p className="text-xs text-muted-foreground">
                    You can create a new security using the "New" button above
                  </p>
                )}
              </div>

              {(transactionType === "buy" || transactionType === "sell") && (
                <>
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
                <Input
                  type="date"
                  value={form.watch("date") ? new Date(form.watch("date")).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : new Date();
                    form.setValue("date", date);
                  }}
                />
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.date.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes..."
                  {...form.register("notes")}
                  rows={3}
                />
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
        <SecurityDialogContent>
          <SecurityDialogHeader>
            <SecurityDialogTitle>Create New Security</SecurityDialogTitle>
            <SecurityDialogDescription>
              Search for a security by symbol or create manually
            </SecurityDialogDescription>
          </SecurityDialogHeader>
          <div className="space-y-4 py-4">
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

