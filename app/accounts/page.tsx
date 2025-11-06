"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { AccountForm } from "@/components/forms/account-form";
import { TableSkeleton } from "@/components/ui/list-skeleton";
import { useToast } from "@/components/toast-provider";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  creditLimit?: number | null;
  householdName?: string | null;
  ownerIds?: string[];
}

export default function AccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this account?")) return;

    const accountToDelete = accounts.find(a => a.id === id);
    
    // Optimistic update: remove from UI immediately
    setAccounts(prev => prev.filter(a => a.id !== id));

    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete account");
      }

      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully.",
        variant: "success",
      });
      
      loadAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      // Revert optimistic update on error
      if (accountToDelete) {
        setAccounts(prev => [...prev, accountToDelete].sort((a, b) => a.name.localeCompare(b.name)));
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Accounts</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your accounts and view balances</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setSelectedAccount(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rowCount={5} />
      ) : (
        <div className="rounded-[12px] border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs md:text-sm">Name</TableHead>
                <TableHead className="text-xs md:text-sm">Type</TableHead>
                <TableHead className="text-xs md:text-sm">Household</TableHead>
                <TableHead className="text-right text-xs md:text-sm">Balance</TableHead>
                {accounts.some((acc) => acc.type === "credit" && acc.creditLimit) && (
                  <>
                    <TableHead className="text-right text-xs md:text-sm hidden md:table-cell">Credit Limit</TableHead>
                    <TableHead className="text-right text-xs md:text-sm hidden md:table-cell">Available</TableHead>
                  </>
                )}
                <TableHead className="text-xs md:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No accounts found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
              const isCreditCard = account.type === "credit" && account.creditLimit;
              const available = isCreditCard 
                ? (account.creditLimit! + account.balance) 
                : null;
              
              return (
                <TableRow key={account.id}>
                  <TableCell className="font-medium text-xs md:text-sm">{account.name}</TableCell>
                  <TableCell>
                    <span className="rounded-[12px] bg-muted px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs capitalize">
                      {account.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs md:text-sm text-muted-foreground">
                    {account.householdName || "-"}
                  </TableCell>
                  <TableCell className={`text-right font-medium text-xs md:text-sm ${
                    account.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatMoney(account.balance)}
                  </TableCell>
                  {accounts.some((acc) => acc.type === "credit" && acc.creditLimit) && (
                    <>
                      <TableCell className="text-right text-xs md:text-sm hidden md:table-cell">
                        {isCreditCard ? formatMoney(account.creditLimit!) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium text-xs md:text-sm hidden md:table-cell ${
                        isCreditCard && available !== null
                          ? available >= 0 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-red-600 dark:text-red-400"
                          : ""
                      }`}>
                        {isCreditCard && available !== null 
                          ? formatMoney(available) 
                          : "-"}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex space-x-1 md:space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-10 md:w-10"
                        onClick={() => {
                          setSelectedAccount(account);
                          setIsFormOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-10 md:w-10"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              }))}
            </TableBody>
          </Table>
        </div>
      )}

      <AccountForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        account={selectedAccount || undefined}
        onSuccess={loadAccounts}
      />
    </div>
  );
}

