"use client";

import { useRouter } from "next/navigation";
import { ChartCard } from "./chart-card";
import { formatMoney } from "@/components/common/money";
import { getCategoryColor } from "@/lib/utils/category-colors";

interface CategoryExpense {
  name: string;
  value: number;
  categoryId?: string | null;
}

interface CategoryExpensesChartProps {
  data: CategoryExpense[];
  totalIncome?: number;
}

export function CategoryExpensesChart({ data, totalIncome = 0 }: CategoryExpensesChartProps) {
  const router = useRouter();
  
  // Sort data by value descending and limit to top 10
  const sortedData = [...data].sort((a, b) => b.value - a.value).slice(0, 10);
  
  // Calculate total expenses for bar visualization
  const totalExpenses = sortedData.reduce((sum, item) => sum + item.value, 0);

  // Prepare data with percentages based on total income
  const chartData = sortedData.map((item) => ({
    ...item,
    percentage: totalIncome > 0 ? (item.value / totalIncome) * 100 : 0,
    // Also keep percentage relative to expenses for bar visualization
    expensePercentage: totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0,
    color: getCategoryColor(item.name),
  }));

  const handleCategoryClick = (categoryId: string | null | undefined) => {
    if (categoryId) {
      router.push(`/transactions?categoryId=${categoryId}`);
    }
  };

  return (
    <ChartCard title="Top 10 expenses" description="Top 10 expenses by category">
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No expenses found for this period
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add transactions to see your spending breakdown
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {chartData.map((item, index) => (
          <div 
            key={item.name} 
            className={`flex items-center justify-between gap-3 ${
              item.categoryId ? "cursor-pointer hover:bg-muted/50 rounded-[12px] p-1 -mx-1 transition-colors" : ""
            }`}
            onClick={() => item.categoryId && handleCategoryClick(item.categoryId)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium truncate">{item.name}</span>
            </div>
              <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex-1 min-w-[100px] max-w-[150px]">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(item.expensePercentage, 100)}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
              <div className="text-right min-w-[70px]">
                <div className="text-sm font-semibold">{formatMoney(item.value)}</div>
                <div className="text-xs text-muted-foreground cursor-help relative group/tooltip inline-block">
                  {item.percentage.toFixed(1)}%
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded-[12px] opacity-0 group-hover/tooltip:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-md">
                    % of total monthly income
                    <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </ChartCard>
  );
}

