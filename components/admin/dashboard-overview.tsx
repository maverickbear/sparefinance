"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Users, UserCheck, UserX, CreditCard, AlertTriangle, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DashboardOverviewProps {
  overview: {
    totalUsers: number;
    usersWithoutSubscription: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    cancelledSubscriptions: number;
    pastDueSubscriptions: number;
    churnRisk: number;
  };
  loading?: boolean;
  initialMaintenanceMode?: boolean;
  onMaintenanceModeChange?: (value: boolean) => void;
  onCardClick?: (filterType: string) => void;
}

export function DashboardOverview({ 
  overview, 
  loading, 
  initialMaintenanceMode = false,
  onMaintenanceModeChange,
  onCardClick
}: DashboardOverviewProps) {
  const { toast } = useToast();
  // OPTIMIZED: Use initialMaintenanceMode prop to avoid duplicate API call
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(initialMaintenanceMode);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);

  // Update maintenance mode when prop changes
  useEffect(() => {
    if (initialMaintenanceMode !== undefined) {
      setMaintenanceMode(initialMaintenanceMode);
    }
  }, [initialMaintenanceMode]);

  // Only load if not provided as prop (fallback for backward compatibility)
  useEffect(() => {
    if (initialMaintenanceMode === undefined && !loadingMaintenance) {
      async function loadMaintenanceMode() {
        try {
          setLoadingMaintenance(true);
          const response = await fetch("/api/v2/admin/system-settings");
          if (response.ok) {
            const data = await response.json();
            setMaintenanceMode(data.maintenanceMode || false);
          }
        } catch (error) {
          console.error("Error loading maintenance mode:", error);
        } finally {
          setLoadingMaintenance(false);
        }
      }
      loadMaintenanceMode();
    }
  }, [initialMaintenanceMode, loadingMaintenance]);

  async function handleMaintenanceToggle(checked: boolean) {
    try {
      setUpdatingMaintenance(true);
      const response = await fetch("/api/v2/admin/system-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maintenanceMode: checked }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update maintenance mode");
      }

      const data = await response.json();
      setMaintenanceMode(data.maintenanceMode);
      
      // Notify parent component of change
      if (onMaintenanceModeChange) {
        onMaintenanceModeChange(data.maintenanceMode);
      }
      
      toast({
        title: checked ? "Maintenance mode enabled" : "Maintenance mode disabled",
        description: checked 
          ? "Only super_admin users can access the platform now."
          : "All users can access the platform normally.",
      });
    } catch (error: any) {
      console.error("Error updating maintenance mode:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update maintenance mode",
        variant: "destructive",
      });
    } finally {
      setUpdatingMaintenance(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const subscriptionRate =
    overview.totalUsers > 0
      ? ((overview.totalSubscriptions / overview.totalUsers) * 100).toFixed(1)
      : "0.0";

  const activeRate =
    overview.totalUsers > 0
      ? ((overview.activeSubscriptions / overview.totalUsers) * 100).toFixed(1)
      : "0.0";

  const trialRate =
    overview.totalUsers > 0
      ? ((overview.trialingSubscriptions / overview.totalUsers) * 100).toFixed(1)
      : "0.0";

  // Calculate additional analytical metrics
  const conversionRate = overview.totalSubscriptions > 0
    ? ((overview.activeSubscriptions / overview.totalSubscriptions) * 100).toFixed(1)
    : "0.0";

  const churnRate = overview.totalSubscriptions > 0
    ? ((overview.cancelledSubscriptions / overview.totalSubscriptions) * 100).toFixed(1)
    : "0.0";

  const churnRiskRate = overview.activeSubscriptions > 0
    ? ((overview.churnRisk / overview.activeSubscriptions) * 100).toFixed(1)
    : "0.0";

  const healthScore = overview.totalSubscriptions > 0
    ? Math.round(
        ((overview.activeSubscriptions / overview.totalSubscriptions) * 0.6 +
         (1 - overview.cancelledSubscriptions / overview.totalSubscriptions) * 0.3 +
         (1 - overview.pastDueSubscriptions / overview.totalSubscriptions) * 0.1) * 100
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* Maintenance Mode Toggle */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle>Maintenance Mode</CardTitle>
                <CardDescription>
                  {maintenanceMode 
                    ? "Platform is in maintenance. Only super_admin can access."
                    : "Platform is operational. All users can access normally."}
                </CardDescription>
              </div>
            </div>
            {loadingMaintenance ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={maintenanceMode}
                onCheckedChange={handleMaintenanceToggle}
                disabled={updatingMaintenance}
              />
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Health Score Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Platform Health Score</CardTitle>
              <CardDescription className="mt-1">
                Overall subscription health based on active, cancelled, and past due metrics
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={cn(
                "text-3xl font-bold",
                healthScore >= 80 ? "text-sentiment-positive" :
                healthScore >= 60 ? "text-sentiment-warning" :
                "text-sentiment-negative"
              )}>
                {healthScore}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Health Score</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Rate</span>
              <span className="font-medium">{activeRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${activeRate}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2 text-xs">
              <div>
                <div className="text-muted-foreground">Conversion</div>
                <div className="font-semibold">{conversionRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Churn Rate</div>
                <div className="font-semibold text-sentiment-negative">{churnRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Churn Risk</div>
                <div className="font-semibold text-sentiment-warning">{churnRiskRate}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${overview.usersWithoutSubscription > 0 ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card 
          className={onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
          onClick={() => onCardClick?.("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalUsers.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {overview.usersWithoutSubscription} without subscription
              {overview.totalUsers > 0 && (
                <span className="ml-1">
                  ({(100 - parseFloat(subscriptionRate)).toFixed(1)}%)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        
        {overview.usersWithoutSubscription > 0 && (
          <Card 
            className={onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
            onClick={() => onCardClick?.("without_subscription")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserX className="h-4 w-4 text-muted-foreground" />
                Without Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.usersWithoutSubscription.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sentiment-warning rounded-full"
                    style={{ 
                      width: `${overview.totalUsers > 0 ? (overview.usersWithoutSubscription / overview.totalUsers) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {overview.totalUsers > 0 
                  ? ((overview.usersWithoutSubscription / overview.totalUsers) * 100).toFixed(1)
                  : "0.0"}% of total users
              </p>
            </CardContent>
          </Card>
        )}

        <Card 
          className={onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
          onClick={() => onCardClick?.("active")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-sentiment-positive" />
              Active Subscriptions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-sentiment-positive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeSubscriptions.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sentiment-positive rounded-full"
                  style={{ width: `${activeRate}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {activeRate}% of total users
              </p>
              <p className="text-xs font-medium text-sentiment-positive">
                {conversionRate}% conversion
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
          onClick={() => onCardClick?.("trialing")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Trialing
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.trialingSubscriptions.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${trialRate}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {trialRate}% of total users
              </p>
              {overview.trialingSubscriptions > 0 && (
                <p className="text-xs font-medium text-primary">
                  Potential revenue
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card 
          className={onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
          onClick={() => onCardClick?.("with_subscription")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Total Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalSubscriptions.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${subscriptionRate}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {subscriptionRate}% subscription rate
              </p>
              <p className="text-xs font-medium">
                {overview.activeSubscriptions + overview.trialingSubscriptions} active/trialing
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card 
          className={cn(
            onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : "",
            overview.cancelledSubscriptions > 0 && "border-sentiment-negative/20"
          )}
          onClick={() => onCardClick?.("cancelled")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-sentiment-negative" />
              Cancelled
            </CardTitle>
            {overview.cancelledSubscriptions > 0 && (
              <TrendingDown className="h-4 w-4 text-sentiment-negative" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.cancelledSubscriptions.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sentiment-negative rounded-full"
                  style={{ 
                    width: `${overview.totalSubscriptions > 0 
                      ? Math.min((overview.cancelledSubscriptions / overview.totalSubscriptions) * 100, 100)
                      : 0}%` 
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Cancelled subscriptions
              </p>
              <p className="text-xs font-medium text-sentiment-negative">
                {churnRate}% churn rate
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : "",
            overview.pastDueSubscriptions > 0 && "border-sentiment-warning/20"
          )}
          onClick={() => onCardClick?.("past_due")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-sentiment-warning" />
              Past Due
            </CardTitle>
            {overview.pastDueSubscriptions > 0 && (
              <AlertTriangle className="h-4 w-4 text-sentiment-warning" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.pastDueSubscriptions.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sentiment-warning rounded-full"
                  style={{ 
                    width: `${overview.totalSubscriptions > 0 
                      ? Math.min((overview.pastDueSubscriptions / overview.totalSubscriptions) * 100, 100)
                      : 0}%` 
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Payment issues
              </p>
              {overview.totalSubscriptions > 0 && (
                <p className="text-xs font-medium text-sentiment-warning">
                  {((overview.pastDueSubscriptions / overview.totalSubscriptions) * 100).toFixed(1)}% of total
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            onCardClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : "",
            overview.churnRisk > 0 && "border-sentiment-warning/20"
          )}
          onClick={() => onCardClick?.("churn_risk")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-sentiment-warning" />
              Churn Risk
            </CardTitle>
            {overview.churnRisk > 0 && (
              <TrendingDown className="h-4 w-4 text-sentiment-warning" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.churnRisk.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sentiment-warning rounded-full"
                  style={{ 
                    width: `${overview.activeSubscriptions > 0 
                      ? Math.min((overview.churnRisk / overview.activeSubscriptions) * 100, 100)
                      : 0}%` 
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Will cancel at period end
              </p>
              <p className="text-xs font-medium text-sentiment-warning">
                {churnRiskRate}% of active
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

