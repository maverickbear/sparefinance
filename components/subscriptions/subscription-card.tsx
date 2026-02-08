"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/components/common/money";
import {
  MoreVertical,
  Edit,
  Trash2,
  Pause,
  Play,
} from "lucide-react";
import type { UserServiceSubscription } from "@/src/domain/subscriptions/subscriptions.types";

export interface SubscriptionCardProps {
  subscription: UserServiceSubscription;
  onEdit: (subscription: UserServiceSubscription) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

const billingFrequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  biweekly: "Biweekly",
  weekly: "Weekly",
  semimonthly: "Semimonthly",
  daily: "Daily",
};

const dayOfWeekLabels: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
  onPause,
  onResume,
}: SubscriptionCardProps) {
  const frequencyLabel = billingFrequencyLabels[subscription.billingFrequency] || subscription.billingFrequency;

  const getBillingDayLabel = () => {
    if (!subscription.billingDay) return null;
    
    if (subscription.billingFrequency === "monthly" || subscription.billingFrequency === "yearly" || subscription.billingFrequency === "semimonthly") {
      return `Day ${subscription.billingDay}`;
    } else if (subscription.billingFrequency === "weekly" || subscription.billingFrequency === "biweekly") {
      return dayOfWeekLabels[subscription.billingDay] || `Day ${subscription.billingDay}`;
    }
    return null;
  };

  const billingDayLabel = getBillingDayLabel();

  return (
    <Card className={!subscription.isActive ? "opacity-75" : ""}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {subscription.serviceLogo && (
                  <img
                    src={subscription.serviceLogo}
                    alt={subscription.serviceName}
                    className="h-8 w-8 object-contain rounded flex-shrink-0"
                    onError={(e) => {
                      // Hide image if it fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <CardTitle className="text-base font-semibold truncate">
                  {subscription.serviceName}
                </CardTitle>
                {!subscription.isActive && (
                  <Badge variant="outline" className="border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400 text-xs">
                    Paused
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{frequencyLabel}</Badge>
                {billingDayLabel && (
                  <span className="text-xs text-muted-foreground">{billingDayLabel}</span>
                )}
                {subscription.subcategory && (
                  <span className="text-xs text-muted-foreground">
                    {subscription.subcategory.name}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(subscription)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {subscription.isActive ? (
                  <DropdownMenuItem onClick={() => onPause(subscription.id)}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onResume(subscription.id)}>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(subscription.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Main Metrics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
              <p className="font-semibold text-base">{formatMoney(subscription.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Account</p>
              <p className="font-semibold text-base truncate">
                {subscription.account?.name || "N/A"}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          {subscription.description && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{subscription.description}</p>
            </div>
          )}

          <div className="pt-2 border-t text-xs">
            <p className="text-muted-foreground">
              First billing: {(() => {
                if (!subscription.firstBillingDate) return "—";
                const date = new Date(subscription.firstBillingDate);
                return isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
              })()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

