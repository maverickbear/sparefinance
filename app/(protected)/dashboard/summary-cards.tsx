"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet } from "lucide-react";
import { AccountsBreakdownModal } from "@/components/dashboard/accounts-breakdown-modal";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/utils/logger";
import { startOfMonth, endOfMonth, format } from "date-fns";

interface SummaryCardsProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
}

export function SummaryCards({ 
  selectedMonthTransactions, 
  lastMonthTransactions, 
  savings,
  totalBalance,
  lastMonthTotalBalance,
  accounts,
}: SummaryCardsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Get selected month from URL or use current month (same logic as MonthSelector)
  const monthParam = searchParams.get("month");
  const selectedMonth = monthParam 
    ? (() => {
        // Parse YYYY-MM-DD format and create date in local timezone
        const [year, month, day] = monthParam.split('-').map(Number);
        return startOfMonth(new Date(year, month - 1, day));
      })()
    : startOfMonth(new Date());
  
  // Calculate start and end dates for the selected month
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const startDateStr = format(monthStart, "yyyy-MM-dd");
  const endDateStr = format(monthEnd, "yyyy-MM-dd");
  
  // Get today's date (without time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper function to parse date from Supabase format
  // Supabase returns dates as "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Filter transactions to only include those with date <= today
  // Temporarily include ALL transactions from the selected month to debug
  const pastTransactions = selectedMonthTransactions.filter((t) => {
    if (!t.date) return false;
    // For now, include all transactions to see if date filtering is the issue
    // TODO: Re-enable date filtering once we confirm transactions are being returned
    return true;
    
    // Original date filtering code (commented out for debugging):
    // try {
    //   const txDate = parseTransactionDate(t.date);
    //   txDate.setHours(0, 0, 0, 0);
    //   return txDate <= today;
    // } catch (error) {
    //   console.error("Error parsing transaction date:", t.date, error);
    //   return true;
    // }
  });

  const pastLastMonthTransactions = lastMonthTransactions.filter((t) => {
    if (!t.date) return false;
    try {
      const txDate = parseTransactionDate(t.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate <= today;
    } catch (error) {
      logger.error("Error parsing transaction date:", t.date, error);
      return true; // Include if date parsing fails
    }
  });

  const log = logger.withPrefix("summary-cards");
  
  // Debug: Log transactions to understand the issue
  // IMPORTANT: Monthly Income should show transactions from the SELECTED MONTH (from MonthSelector)
  // selectedMonthTransactions already contains transactions from the selected month
  log.log("Processing transactions for Monthly Income (SELECTED MONTH):", {
    note: "Monthly Income shows transactions from the month selected in MonthSelector at the top",
      totalTransactions: selectedMonthTransactions.length,
      pastTransactions: pastTransactions.length,
      today: today.toISOString(),
      allTransactionTypes: [...new Set(selectedMonthTransactions.map(t => t?.type).filter(Boolean))],
    incomeTransactions: pastTransactions.filter((t) => t && t.type === "income"),
    incomeTransactionsCount: pastTransactions.filter((t) => t && t.type === "income").length,
    expenseTransactionsCount: pastTransactions.filter((t) => t && t.type === "expense").length,
    incomeTransactionsDetails: pastTransactions
      .filter((t) => t && t.type === "income")
      .map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        amountType: typeof t.amount,
        parsedAmount: t.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : null,
        date: t.date,
        description: t.description,
      })),
    sampleTransactions: selectedMonthTransactions.slice(0, 5).map(t => ({ 
        id: t?.id,
        type: t?.type, 
        amount: t?.amount, 
        amountType: typeof t?.amount,
        parsed: t?.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : null,
        date: t?.date,
      })),
    });

  const currentIncome = pastTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      const newSum = sum + amount;
      log.log("Calculating income - transaction:", {
        id: t.id,
        type: t.type,
        amount: t.amount,
        parsedAmount: amount,
        currentSum: sum,
        newSum: newSum,
      });
      return newSum;
    }, 0);

  log.log("Final Monthly Income calculation:", {
    currentIncome,
    incomeTransactionsCount: pastTransactions.filter((t) => t && t.type === "income").length,
    totalPastTransactions: pastTransactions.length,
  });

  const currentExpenses = pastTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  log.log("Final Monthly Expenses calculation:", {
    currentExpenses,
    expenseTransactionsCount: pastTransactions.filter((t) => t && t.type === "expense").length,
  });

  const lastMonthIncome = pastLastMonthTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const lastMonthExpenses = pastLastMonthTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const incomeMomChange = lastMonthIncome > 0
    ? ((currentIncome - lastMonthIncome) / lastMonthIncome) * 100
    : 0;

  const expensesMomChange = lastMonthExpenses > 0
    ? ((currentExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;

  // Calculate balance change
  const balanceChange = totalBalance - lastMonthTotalBalance;
  const balanceChangePercent = lastMonthTotalBalance !== 0
    ? (balanceChange / Math.abs(lastMonthTotalBalance)) * 100
    : 0;

  // Handle scroll for carousel indicators
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      // Get the first card to calculate its actual width
      const firstCard = carousel.querySelector('.snap-start') as HTMLElement;
      if (!firstCard) return;
      
      const cardWidth = firstCard.offsetWidth;
      const gap = 16; // 1rem = 16px (gap-4)
      const totalCardWidth = cardWidth + gap;
      const newIndex = Math.round(scrollLeft / totalCardWidth);
      setActiveIndex(Math.min(Math.max(newIndex, 0), 3)); // 4 cards total (0-3)
    };

    carousel.addEventListener('scroll', handleScroll);
    // Also check on mount
    handleScroll();
    return () => carousel.removeEventListener('scroll', handleScroll);
  }, []);

  // Cards data for easier mapping
  const cards = [
    {
      id: 'balance',
      title: 'Total Balance',
      icon: Wallet,
      iconColor: 'text-blue-600 dark:text-blue-500',
      value: totalBalance,
      valueColor: totalBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: balanceChange !== 0 ? (
        <div className={`text-xs mt-1 ${
          balanceChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        }`}>
          {balanceChange >= 0 ? "+" : ""}{formatMoney(balanceChange)} ({balanceChangePercent >= 0 ? "+" : ""}{balanceChangePercent.toFixed(1)}%)
        </div>
      ) : null,
      onClick: () => setIsModalOpen(true),
    },
    {
      id: 'income',
      title: 'Monthly Income',
      icon: ArrowUpRight,
      iconColor: 'text-green-600 dark:text-green-500',
      value: currentIncome,
      valueColor: 'text-foreground',
      change: (
        <div className={`text-xs mt-1 ${
          lastMonthIncome > 0
            ? incomeMomChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            : "text-muted-foreground"
        }`}>
          {lastMonthIncome > 0
            ? `${incomeMomChange >= 0 ? "+" : ""}${incomeMomChange.toFixed(1)}% vs last month`
            : "No data last month"
          }
        </div>
      ),
      onClick: () => {
        router.push(`/transactions?type=income&startDate=${startDateStr}&endDate=${endDateStr}`);
      },
    },
    {
      id: 'expenses',
      title: 'Monthly Expenses',
      icon: ArrowDownRight,
      iconColor: 'text-red-600 dark:text-red-500',
      value: currentExpenses,
      valueColor: 'text-foreground',
      change: (
        <div className={`text-xs mt-1 ${
          lastMonthExpenses > 0
            ? expensesMomChange >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            : "text-muted-foreground"
        }`}>
          {lastMonthExpenses > 0
            ? `${expensesMomChange >= 0 ? "+" : ""}${expensesMomChange.toFixed(1)}% vs last month`
            : "No data last month"
          }
        </div>
      ),
      onClick: () => {
        router.push(`/transactions?type=expense&startDate=${startDateStr}&endDate=${endDateStr}`);
      },
    },
    {
      id: 'savings',
      title: 'Savings/Investments',
      icon: TrendingUp,
      iconColor: 'text-blue-600 dark:text-blue-500',
      value: savings,
      valueColor: 'text-foreground',
      change: null,
      onClick: undefined,
    },
  ];

  return (
    <>
      {/* Mobile Carousel */}
      <div className="md:hidden">
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.id}
                className={cn(
                  "flex-shrink-0 w-[calc(100vw-6rem)] snap-start transition-all",
                  card.onClick && "cursor-pointer hover:shadow-md hover:border-primary/50"
                )}
                onClick={card.onClick}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-normal">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", card.iconColor)} />
                    <div className={cn("text-2xl font-semibold", card.valueColor)}>
                      {formatMoney(card.value)}
                    </div>
                  </div>
                  {card.change}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {/* Carousel Indicators */}
        <div className="flex justify-center gap-2 mt-3">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                const carousel = carouselRef.current;
                if (carousel) {
                  const firstCard = carousel.querySelector('.snap-start') as HTMLElement;
                  if (!firstCard) return;
                  
                  const cardWidth = firstCard.offsetWidth;
                  const gap = 16; // 1rem = 16px (gap-4)
                  const totalCardWidth = cardWidth + gap;
                  carousel.scrollTo({ left: index * totalCardWidth, behavior: 'smooth' });
                }
              }}
              className={cn(
                "h-2 rounded-full transition-all",
                activeIndex === index
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              )}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid gap-4 md:gap-5 grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.id}
              className={cn(
                card.onClick && "cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
              )}
              onClick={card.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", card.iconColor)} />
                  <div className={cn("text-2xl font-semibold", card.valueColor)}>
                    {formatMoney(card.value)}
                  </div>
                </div>
                {card.change}
              </CardContent>
            </Card>
          );
        })}
    </div>

    <AccountsBreakdownModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      accounts={accounts}
      totalBalance={totalBalance}
    />
    </>
  );
}

