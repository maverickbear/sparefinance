"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

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
}

export function DashboardOverview({ overview, loading }: DashboardOverviewProps) {
  const { toast } = useToast();
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);

  // Load maintenance mode status
  useEffect(() => {
    async function loadMaintenanceMode() {
      try {
        setLoadingMaintenance(true);
        const response = await fetch("/api/admin/system-settings");
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
  }, []);

  async function handleMaintenanceToggle(checked: boolean) {
    try {
      setUpdatingMaintenance(true);
      const response = await fetch("/api/admin/system-settings", {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {overview.usersWithoutSubscription} without subscription
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {activeRate}% of total users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trialing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.trialingSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {trialRate}% of total users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {subscriptionRate}% subscription rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.cancelledSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              Cancelled subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.pastDueSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              Payment issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.churnRisk}</div>
            <p className="text-xs text-muted-foreground">
              Will cancel at period end
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

