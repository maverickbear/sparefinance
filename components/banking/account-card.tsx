"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Helper function to get initials from name
function getInitials(name: string | null | undefined): string {
  try {
    if (!name) return "?";
    const trimmed = name.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return "?";
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    const first = parts[0][0] || "";
    const last = parts[parts.length - 1][0] || "";
    return (first + last).toUpperCase() || "?";
  } catch (error) {
    console.error("Error getting initials:", error);
    return "?";
  }
}

export interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: string;
    balance: number;
    creditLimit?: number | null;
    householdName?: string | null;
    ownerName?: string | null;
    ownerAvatarUrl?: string | null;
    isConnected?: boolean;
    lastSyncedAt?: string | null;
    institutionName?: string | null;
    institutionLogo?: string | null;
  };
  onEdit?: (accountId: string) => void;
  onDelete?: (accountId: string) => void;
  onSync?: (accountId: string) => void;
  onDisconnect?: (accountId: string) => void;
  deletingId?: string | null;
  syncingId?: string | null;
  disconnectingId?: string | null;
  canDelete?: boolean;
  canEdit?: boolean;
}

export function AccountCard({
  account,
  onEdit,
  onDelete,
  onSync,
  onDisconnect,
  deletingId,
  syncingId,
  disconnectingId,
  canDelete = true,
  canEdit = true,
}: AccountCardProps) {
  const isCreditCard = account.type === "credit" && account.creditLimit;
  const available = isCreditCard 
    ? (account.creditLimit! + account.balance) 
    : null;

  return (
    <Card className="transition-all flex flex-col">
      <CardHeader className="pb-3 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {account.institutionLogo ? (
              <img 
                src={account.institutionLogo} 
                alt={account.institutionName || 'Bank logo'} 
                className="h-6 w-6 rounded object-contain flex-shrink-0"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold truncate">{account.name}</CardTitle>
              {account.institutionName && (
                <p className="text-sm text-muted-foreground truncate">{account.institutionName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {account.isConnected && (
              <>
                {onSync && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSync(account.id);
                    }}
                    disabled={syncingId === account.id}
                    title="Sync transactions"
                  >
                    {syncingId === account.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                {onDisconnect && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDisconnect(account.id);
                    }}
                    disabled={disconnectingId === account.id}
                    title="Disconnect account"
                  >
                    {disconnectingId === account.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </>
            )}
            {onEdit && canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(account.id);
                }}
                title="Edit account"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(account.id);
                }}
                disabled={deletingId === account.id || account.isConnected}
                title={account.isConnected ? "Cannot delete connected account. Disconnect first." : "Delete account"}
              >
                {deletingId === account.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="capitalize text-sm px-1.5 py-0.5">
            {account.type}
          </Badge>
          {account.householdName && (
            <div className="flex items-center">
              {account.ownerAvatarUrl ? (
                <>
                  <img
                    src={account.ownerAvatarUrl}
                    alt={account.ownerName || account.householdName || "Owner"}
                    className="h-8 w-8 rounded-full object-cover border"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const initialsContainer = e.currentTarget.nextElementSibling;
                      if (initialsContainer) {
                        (initialsContainer as HTMLElement).style.display = "flex";
                      }
                    }}
                  />
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-sm font-semibold border">
                    {getInitials(account.ownerName || account.householdName)}
                  </div>
                </>
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold border">
                  {getInitials(account.ownerName || account.householdName)}
                </div>
              )}
            </div>
          )}
          {account.isConnected && (
            <Badge variant="default" className="bg-green-600 dark:bg-green-500 text-white text-sm px-1.5 py-0.5">
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 flex-1 p-4 pt-0">
        <div className="space-y-2">
          {isCreditCard ? (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-sm text-muted-foreground mb-0.5">Balance</div>
                <div className={cn(
                  "text-sm font-bold",
                  account.balance >= 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  {formatMoney(account.balance)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-0.5">Credit Limit</div>
                <div className="text-sm font-semibold">
                  {formatMoney(account.creditLimit!)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-0.5">Available</div>
                <div className={cn(
                  "text-sm font-semibold",
                  available !== null && available >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}>
                  {available !== null ? formatMoney(available) : "-"}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-muted-foreground mb-0.5">Balance</div>
              <div className={cn(
                "text-lg font-bold",
                account.balance >= 0 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                {formatMoney(account.balance)}
              </div>
            </div>
          )}
          {account.isConnected && account.lastSyncedAt && (() => {
            try {
              const syncDate = new Date(account.lastSyncedAt);
              // Check if date is valid
              if (isNaN(syncDate.getTime())) {
                return null;
              }
              return (
                <div className="text-sm text-muted-foreground pt-2 border-t">
                  Last synced: {format(syncDate, 'MMM dd, HH:mm')}
                </div>
              );
            } catch (error) {
              console.error("Error formatting lastSyncedAt:", error);
              return null;
            }
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

