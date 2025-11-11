"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { Edit, Trash2, Loader2, Repeat, Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/api/transactions-client";

interface TransactionsMobileCardProps {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  onCategoryClick: () => void;
  onApplySuggestion?: () => void;
  onRejectSuggestion?: () => void;
  processingSuggestion?: boolean;
}

export function TransactionsMobileCard({
  transaction,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  deleting,
  onCategoryClick,
  onApplySuggestion,
  onRejectSuggestion,
  processingSuggestion,
}: TransactionsMobileCardProps) {
  const plaidMeta = transaction.plaidMetadata as any;
  const isPending = plaidMeta?.pending;
  const authorizedDate = plaidMeta?.authorized_date || plaidMeta?.authorized_datetime;
  const currencyCode = plaidMeta?.iso_currency_code || plaidMeta?.unofficial_currency_code;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with checkbox and amount */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="h-4 w-4 mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-lg font-semibold",
                    transaction.type === "income" ? "text-green-600 dark:text-green-400" :
                    transaction.type === "expense" ? "text-red-600 dark:text-red-400" : ""
                  )}>
                    {transaction.type === "expense" ? "-" : ""}{formatMoney(transaction.amount)}
                  </span>
                  {currencyCode && currencyCode !== "USD" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {currencyCode}
                    </Badge>
                  )}
                </div>
                {transaction.description && (
                  <p className="text-sm text-foreground mt-1 line-clamp-2">
                    {transaction.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Date and Type */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</span>
              <span className="text-sm font-medium">{format(new Date(transaction.date), "MMM dd, yyyy")}</span>
              {authorizedDate && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Auth: {format(new Date(authorizedDate), "MMM dd")}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "rounded-[12px] px-2 py-1 text-xs",
                  transaction.type === "income" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                  transaction.type === "expense" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                )}>
                  {transaction.type}
                </span>
                {transaction.recurring && (
                  <span title="Recurring transaction">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account */}
          {transaction.account?.name && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account</span>
              <span className="text-sm font-medium">{transaction.account.name}</span>
            </div>
          )}

          {/* Category */}
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</span>
            {transaction.category?.name ? (
              <span 
                className="text-sm font-medium text-blue-600 dark:text-blue-400 underline decoration-dashed underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick();
                }}
              >
                {transaction.category.name}
                {transaction.subcategory && ` / ${transaction.subcategory.name}`}
              </span>
            ) : transaction.suggestedCategoryId ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground italic flex-1">
                  {transaction.suggestedCategory?.name || "Suggested category"}
                  {transaction.suggestedSubcategory && ` / ${transaction.suggestedSubcategory.name}`}
                </span>
                <div className="flex items-center gap-1">
                  {onRejectSuggestion && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-[8px] border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRejectSuggestion();
                      }}
                      disabled={processingSuggestion}
                    >
                      {processingSuggestion ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  {onApplySuggestion && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-[8px] border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplySuggestion();
                      }}
                      disabled={processingSuggestion}
                    >
                      {processingSuggestion ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <span 
                className="text-sm font-medium text-blue-600 dark:text-blue-400 underline decoration-dashed underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick();
                }}
              >
                Add Category
              </span>
            )}
          </div>

          {/* Status */}
          {(isPending || (currencyCode && currencyCode !== "USD")) && (
            <div className="flex flex-wrap gap-2">
              {isPending && (
                <Badge variant="outline" className="text-[10px] px-2 py-1 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

