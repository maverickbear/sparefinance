"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { formatTransactionDate, formatShortDate } from "@/lib/utils/timestamp";
import { Loader2, Repeat, Clock, Check, X, Wallet, ShoppingCart, UtensilsCrossed, Car, Home, Heart, GraduationCap, Gamepad2, Plane, Dumbbell, Shirt, Laptop, Music, BookOpen, Gift, CreditCard, Building2, Briefcase, PiggyBank, TrendingUp, Coffee, Receipt as ReceiptIcon, Tag, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/src/domain/transactions/transactions.types";

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

// Helper function to get category icon
function getCategoryIcon(categoryName: string | null | undefined) {
  if (!categoryName) return Tag;
  
  const normalized = categoryName.toLowerCase().trim();
  
  // Map category names to icons
  const iconMap: Record<string, any> = {
    // Housing
    "rent": Home,
    "rent / mortgage": Home,
    "utilities": Home,
    "home maintenance": Home,
    "home insurance": Home,
    
    // Transportation
    "vehicle": Car,
    "public transit": Car,
    
    // Food
    "groceries": ShoppingCart,
    "restaurants": UtensilsCrossed,
    "snacks & drinks": Coffee,
    
    // Health & Personal
    "medical": Heart,
    "healthcare": Heart,
    "personal care": Heart,
    "fitness": Dumbbell,
    
    // Family & Kids
    "baby essentials": Gift,
    "child/baby": Gift,
    "education": GraduationCap,
    "activities": Gamepad2,
    
    // Insurance
    "insurance payments": Shield,
    
    // Debts
    "loans": CreditCard,
    "credit cards": CreditCard,
    "other debts": CreditCard,
    
    // Shopping
    "clothing": Shirt,
    "electronics": Laptop,
    "home & lifestyle": Home,
    
    // Entertainment & Leisure
    "streaming": Music,
    "gaming": Gamepad2,
    "events": Music,
    "travel": Plane,
    
    // Education & Work
    "courses & certificates": GraduationCap,
    "books": BookOpen,
    "software & tools": Laptop,
    
    // Pets
    "pet care": Heart,
    
    // Gifts & Donations
    "gifts": Gift,
    "donations": Gift,
    
    // Business Expenses
    "home office": Briefcase,
    "software": Laptop,
    "professional services": Briefcase,
    "marketing": Briefcase,
    "office": Briefcase,
    
    // Subscriptions
    "subscriptions": Music,
    
    // Savings
    "emergency fund": PiggyBank,
    "rrsp": PiggyBank,
    "fhsa": PiggyBank,
    "tfsa": PiggyBank,
    
    // Investments
    "stocks": TrendingUp,
    "crypto": TrendingUp,
    "investment income": TrendingUp,
    "rental income": TrendingUp,
    
    // Income
    "salary & wages": Wallet,
    "extra compensation": Wallet,
    "business income": Wallet,
    "benefits": Wallet,
    "gig work": Wallet,
    "sales": Wallet,
    "content creation": Wallet,
    "family support": Wallet,
    "reimbursements": Wallet,
    
    // Misc
    "bank fees": ReceiptIcon,
    "overdraft": CreditCard,
    "unexpected": Tag,
    "uncategorized": Tag,
    "other": Tag,
  };
  
  // Check exact match
  if (iconMap[normalized]) {
    return iconMap[normalized];
  }
  
  // Check partial match
  for (const [key, icon] of Object.entries(iconMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }
  
  // Default icon
  return Tag;
}

// Helper function to get color for avatar based on category
// Returns a style object with backgroundColor for inline styles
function getCategoryColorStyle(categoryName: string | null | undefined): React.CSSProperties {
  if (!categoryName) return { backgroundColor: "#6b7280" }; // gray-500
  const colors = [
    "#10b981", // green-500
    "#3b82f6", // blue-500
    "#8b5cf6", // purple-500
    "#ec4899", // pink-500
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#eab308", // yellow-500
    "#6366f1", // indigo-500
    "#14b8a6", // teal-500
    "#06b6d4"  // cyan-500
  ];
  const hash = categoryName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return { backgroundColor: colors[hash % colors.length] };
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
  const description = transaction.description || "Transaction";
  const displayName = transaction.description || transaction.category?.name || "Transaction";
  const date = formatTransactionDate(transaction.date);
  const isIncome = transaction.type === "income";
  const isExpense = transaction.type === "expense";
  const categoryName = transaction.category?.name;
  const CategoryIcon = getCategoryIcon(categoryName);

  return (
    <Card 
      className="overflow-hidden cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent border-0 border-b border-border rounded-none shadow-none"
      onClick={onEdit}
    >
      <CardContent className="px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Avatar - Category Icon */}
          <div className="flex-shrink-0">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={getCategoryColorStyle(categoryName)}
            >
              <CategoryIcon className="h-5 w-5" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate text-[14px]">{displayName}</h3>
            <p className="text-muted-foreground mt-0.5 text-[12px]">{date}</p>
          </div>

          {/* Amount */}
          <div className="flex-shrink-0">
                <span className={cn(
              "text-base font-medium",
              isIncome ? "text-green-600 dark:text-green-400" : 
              isExpense ? "text-red-600 dark:text-red-400" : 
              "text-foreground"
                )}>
              {formatMoney(transaction.amount)}
                  </span>
          </div>
            </div>

        {/* Category actions - shown on long press or swipe */}
        {transaction.suggestedCategoryId && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground italic flex-1">
              Suggested: {transaction.suggestedCategory?.name || "category"}
              </span>
            <div className="flex items-center gap-1">
                  {onRejectSuggestion && (
                    <Button
                      variant="outline"
                      size="icon"
                  className="h-8 w-8 rounded-[8px] border-sentiment-negative/30 text-sentiment-negative hover:text-sentiment-negative hover:bg-sentiment-negative/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRejectSuggestion();
                      }}
                      disabled={processingSuggestion}
                    >
                      {processingSuggestion ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                    <X className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  {onApplySuggestion && (
                    <Button
                      variant="outline"
                      size="icon"
                  className="h-8 w-8 rounded-[8px] border-sentiment-positive/30 text-sentiment-positive hover:text-sentiment-positive hover:bg-sentiment-positive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplySuggestion();
                      }}
                      disabled={processingSuggestion}
                    >
                      {processingSuggestion ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                    <Check className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

