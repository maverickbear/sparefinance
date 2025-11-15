"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { MoreVertical, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useToast } from "@/components/toast-provider";

interface UpcomingTransaction {
  id: string;
  date: Date;
  type: string;
  amount: number;
  description?: string;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string; logo?: string | null } | null;
  originalDate: Date;
  isDebtPayment?: boolean;
}

interface UpcomingTransactionsProps {
  transactions: UpcomingTransaction[];
}

// Generate a unique key for each transaction occurrence
const getTransactionKey = (tx: UpcomingTransaction) => {
  return `${tx.id}-${tx.date.toISOString()}`;
};

// Storage key for paid transactions
const STORAGE_KEY = "upcoming-transactions-paid";

export function UpcomingTransactions({ transactions }: UpcomingTransactionsProps) {
  const { toast } = useToast();
  const [paidTransactions, setPaidTransactions] = useState<Set<string>>(new Set());
  const [creatingTransaction, setCreatingTransaction] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Normalize transactions - convert date strings to Date objects
  const normalizedTransactions = (transactions || []).map((tx) => {
    let date: Date;
    let originalDate: Date;
    
    try {
      date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (isNaN(date.getTime())) {
        console.warn("Invalid date for transaction:", tx.id, tx.date);
        date = new Date(); // Fallback to today
      }
    } catch (e) {
      console.warn("Error parsing date for transaction:", tx.id, tx.date, e);
      date = new Date(); // Fallback to today
    }
    
    try {
      originalDate = tx.originalDate instanceof Date 
        ? tx.originalDate 
        : new Date(tx.originalDate || tx.date);
      if (isNaN(originalDate.getTime())) {
        originalDate = date; // Fallback to date
      }
    } catch (e) {
      originalDate = date; // Fallback to date
    }
    
    return {
      ...tx,
      date,
      originalDate,
    };
  }).filter((tx) => {
    // Filter out transactions with invalid dates
    return tx.date instanceof Date && !isNaN(tx.date.getTime());
  });

  // Debug log
  useEffect(() => {
    console.log("🔍 [UpcomingTransactions] Received transactions:", {
      rawCount: transactions?.length || 0,
      normalizedCount: normalizedTransactions.length,
      transactions: normalizedTransactions.slice(0, 3).map((tx) => ({
        id: tx.id,
        description: tx.description,
        category: tx.category?.name,
        date: tx.date,
        dateType: typeof tx.date,
        amount: tx.amount,
        type: tx.type,
      })),
    });
  }, [transactions, normalizedTransactions.length]);

  // Load paid transactions from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const paidSet = new Set<string>(JSON.parse(stored));
          setPaidTransactions(paidSet);
        }
      } catch (error) {
        console.error("Error loading paid transactions:", error);
      }
    }
  }, []);

  // Save paid transactions to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(paidTransactions)));
      } catch (error) {
        console.error("Error saving paid transactions:", error);
      }
    }
  }, [paidTransactions]);

  const togglePaid = async (tx: UpcomingTransaction) => {
    const key = getTransactionKey(tx);
    const isCurrentlyPaid = paidTransactions.has(key);
    
    // If marking as paid, create a transaction
    if (!isCurrentlyPaid) {
      // Check if this is a debt payment - if so, the transaction might already exist
      // For recurring transactions, we should create a new one with the specific date
      if (!tx.account?.id) {
        toast({
          title: "Error",
          description: "Cannot create transaction: account is required",
          variant: "destructive",
        });
        return;
      }

      setCreatingTransaction((prev) => new Set(prev).add(key));
      
      try {
        const payload = {
          date: tx.date.toISOString(),
          type: tx.type,
          amount: tx.amount,
          accountId: tx.account.id,
          categoryId: tx.category?.id || null,
          subcategoryId: tx.subcategory?.id || null,
          description: tx.description || null,
          recurring: false, // Mark as non-recurring since this is a one-time payment
        };

        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create transaction");
        }

        // Mark as paid in localStorage
        setPaidTransactions((prev) => {
          const newSet = new Set(prev);
          newSet.add(key);
          return newSet;
        });

        toast({
          title: "Transaction created",
          description: "Payment has been recorded as a transaction",
          variant: "success",
        });
      } catch (error) {
        console.error("Error creating transaction:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create transaction",
          variant: "destructive",
        });
      } finally {
        setCreatingTransaction((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    } else {
      // If unmarking as paid, just remove from localStorage
      // Note: We don't delete the transaction that was created
      setPaidTransactions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const isPaid = (tx: UpcomingTransaction) => {
    return paidTransactions.has(getTransactionKey(tx));
  };

  // Filter transactions to show only those in the current month
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  monthStart.setHours(0, 0, 0, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const filteredTransactions = normalizedTransactions.filter((tx) => {
    // Show both expenses and incomes
    const txDate = new Date(tx.date);
    txDate.setHours(0, 0, 0, 0);
    return txDate >= monthStart && txDate <= monthEnd;
  });
  
  if (!filteredTransactions || filteredTransactions.length === 0) {
    return (
      <Card className="border-0 p-0 shadow-none">
        <CardHeader className="pb-3 px-0 pt-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Upcoming payment</CardTitle>
            <Link 
              href="/transactions" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              See all
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming transactions found.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getDaysRemaining = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const txDate = new Date(date);
    txDate.setHours(0, 0, 0, 0);
    const days = differenceInDays(txDate, today);
    return days;
  };

  const getCardBackgroundColor = () => {
    return "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700";
  };

  const getCardTextColor = () => {
    return "text-gray-900 dark:text-gray-100";
  };

  const getServiceInitial = (tx: UpcomingTransaction) => {
    // Use the same priority as getServiceName for consistency
    const name = tx.subcategory?.name || tx.category?.name || tx.description || "T";
    return name.charAt(0).toUpperCase();
  };

  const getServiceName = (tx: UpcomingTransaction) => {
    // Priority: subcategory > category > description
    if (tx.subcategory?.name) {
      return tx.subcategory.name;
    }
    if (tx.category?.name) {
      return tx.category.name;
    }
    return tx.description || "Transaction";
  };

  return (
    <Card className="border-0 p-0 shadow-none">
      <CardHeader className="pb-3 px-0 pt-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Upcoming payment</CardTitle>
          <Link 
            href="/transactions" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="relative">
          {/* Carousel container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
          >
            {filteredTransactions.map((tx, index) => {
              const paid = isPaid(tx);
              const daysRemaining = getDaysRemaining(tx.date);
              const bgColor = getCardBackgroundColor();
              const textColor = getCardTextColor();

              return (
                <div
                  key={getTransactionKey(tx)}
                  className={cn(
                    "relative rounded-xl p-3 flex-shrink-0 flex flex-col justify-between transition-all snap-start",
                    bgColor,
                    paid && "opacity-60"
                  )}
                  style={{
                    width: "150px",
                    height: "150px",
                  }}
                >
                  {/* Top section: Logo and menu */}
                  <div className="flex items-start justify-between">
                    {tx.subcategory?.logo ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img 
                          src={tx.subcategory.logo} 
                          alt={getServiceName(tx)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to initial if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.parentElement?.querySelector('.fallback-initial');
                            if (fallback) {
                              (fallback as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                        <div className="fallback-initial hidden w-full h-full items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-300">
                          {getServiceInitial(tx)}
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {getServiceInitial(tx)}
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            "p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                            textColor
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => togglePaid(tx)}
                          disabled={creatingTransaction.has(getTransactionKey(tx))}
                        >
                          {creatingTransaction.has(getTransactionKey(tx)) 
                            ? "Creating transaction..." 
                            : paid 
                            ? "Mark as unpaid" 
                            : "Mark as paid"}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/transactions">View details</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Bottom section: Service name, amount, and days */}
                  <div className="space-y-0.5">
                    <h3 className={cn(
                      "font-bold text-sm leading-tight line-clamp-2",
                      textColor,
                      paid && "line-through"
                    )}>
                      {getServiceName(tx)}
                    </h3>
                    <p className={cn(
                      "text-xs font-medium flex items-center gap-1",
                      textColor,
                      paid && "line-through"
                    )}>
                      {tx.type === "expense" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : tx.type === "income" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : null}
                      {formatMoney(tx.amount)}
                      {tx.type === "expense" && "/mo"}
                    </p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">
                      {daysRemaining === 0
                        ? "Today"
                        : daysRemaining === 1
                        ? "1 day left"
                        : `${daysRemaining} days left`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

