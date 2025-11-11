"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Wallet, TrendingUp, Activity } from "lucide-react";

interface SyncStats {
  accounts: number;
  holdings: number;
  transactions: number;
  lastSyncedAt?: string | null;
}

interface SyncStatsCardProps {
  stats: SyncStats | null;
}

export function SyncStatsCard({ stats }: SyncStatsCardProps) {
  if (!stats) {
    return null;
  }

  const totalItems = stats.accounts + stats.holdings + stats.transactions;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Estatísticas de Sincronização</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total de itens</span>
            </div>
            <Badge variant="outline" className="text-sm font-semibold">
              {totalItems}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.accounts}</div>
                <div className="text-xs text-muted-foreground">Contas</div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.holdings}</div>
                <div className="text-xs text-muted-foreground">Posições</div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.transactions}</div>
                <div className="text-xs text-muted-foreground">Transações</div>
              </div>
            </div>
          </div>

          {stats.lastSyncedAt && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Última sincronização: {new Date(stats.lastSyncedAt).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

