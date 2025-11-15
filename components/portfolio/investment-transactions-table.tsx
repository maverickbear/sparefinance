"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Trash2, Plus, Search } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { useToast } from "@/components/toast-provider";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { InvestmentTransactionForm } from "@/components/forms/investment-transaction-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  } | Array<{
    id: string;
    symbol: string;
    name: string;
    class: string;
  }>;
  account?: {
    id: string;
    name: string;
    type: string;
  } | Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
}

interface InvestmentTransactionsTableProps {
  onTransactionChange?: () => void;
}

export function InvestmentTransactionsTable({ 
  onTransactionChange 
}: InvestmentTransactionsTableProps) {
  const { toast } = useToast();
  const { checkWriteAccess } = useWriteGuard();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [transactionsRes, accountsRes] = await Promise.all([
        fetch("/api/investments/transactions"),
        fetch("/api/portfolio/accounts"),
      ]);

      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data);
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (selectedAccount !== "all") {
      filtered = filtered.filter((tx) => tx.accountId === selectedAccount);
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((tx) => tx.type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.security?.symbol?.toLowerCase().includes(query) ||
          tx.security?.name?.toLowerCase().includes(query) ||
          tx.account?.name?.toLowerCase().includes(query) ||
          tx.notes?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [transactions, selectedAccount, selectedType, searchQuery]);

  function handleEdit(transaction: InvestmentTransaction) {
    if (!checkWriteAccess()) return;
    setEditingTransaction(transaction);
    setShowForm(true);
  }

  function handleDeleteClick(transactionId: string) {
    if (!checkWriteAccess()) return;
    setTransactionToDelete(transactionId);
    setShowDeleteDialog(true);
  }

  async function handleDeleteConfirm() {
    if (!transactionToDelete) return;

    try {
      setDeletingId(transactionToDelete);
      const response = await fetch(`/api/investments/transactions/${transactionToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });

      setShowDeleteDialog(false);
      setTransactionToDelete(null);
      loadData();
      onTransactionChange?.();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleFormSuccess() {
    setShowForm(false);
    setEditingTransaction(null);
    loadData();
    onTransactionChange?.();
  }

  function handleAddNew() {
    if (!checkWriteAccess()) return;
    setEditingTransaction(null);
    setShowForm(true);
  }

  const totalValue = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => {
      if (tx.quantity && tx.price) {
        const transactionValue = tx.quantity * tx.price + (tx.fees || 0);
        // For sell transactions, subtract the value (it's money coming out)
        // For buy transactions, add the value (it's money going in)
        // For dividend/interest, add the value (it's income)
        if (tx.type === "sell") {
          return sum - transactionValue;
        } else {
          return sum + transactionValue;
        }
      }
      return sum;
    }, 0);
  }, [filteredTransactions]);

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-4">Investment Transactions</h2>
        </div>
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by symbol, name, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="dividend">Dividend</SelectItem>
                <SelectItem value="interest">Interest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {filteredTransactions.length > 0 && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
                </span>
                {totalValue > 0 && (
                  <span className="font-semibold">
                    Total Value: {formatMoney(totalValue)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <p className="text-sm">No transactions found</p>
                {transactions.length === 0 && (
                  <Button
                    onClick={handleAddNew}
                    variant="outline"
                    className="mt-4"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Transaction
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Security</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => {
                    const total = transaction.quantity && transaction.price
                      ? transaction.quantity * transaction.price + (transaction.fees || 0)
                      : 0;

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(transaction.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          {Array.isArray(transaction.account) 
                            ? transaction.account[0]?.name || transaction.accountId
                            : transaction.account?.name || transaction.accountId}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-semibold">
                              {Array.isArray(transaction.security)
                                ? transaction.security[0]?.symbol || transaction.securityId || "-"
                                : transaction.security?.symbol || transaction.securityId || "-"}
                            </span>
                            {(Array.isArray(transaction.security) 
                              ? transaction.security[0]?.name 
                              : transaction.security?.name) && (
                              <span className="text-xs text-muted-foreground hidden lg:block">
                                {Array.isArray(transaction.security)
                                  ? transaction.security[0]?.name
                                  : transaction.security?.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              transaction.type === "buy"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-300"
                                : transaction.type === "sell"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-300"
                            }
                          >
                            {transaction.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.quantity?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.price ? formatMoney(transaction.price) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(transaction.fees || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {total > 0 ? formatMoney(total) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {transaction.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(transaction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(transaction.id)}
                              disabled={deletingId === transaction.id}
                            >
                              {deletingId === transaction.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setTransactionToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletingId !== null}
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Form */}
      <InvestmentTransactionForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            setEditingTransaction(null);
          }
        }}
        onSuccess={handleFormSuccess}
        transaction={editingTransaction}
      />
    </>
  );
}

