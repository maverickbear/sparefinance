"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersTable } from "@/components/admin/users-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { SubscriptionDialog } from "@/components/admin/subscription-dialog";
import { BlockUserDialog } from "@/components/admin/block-user-dialog";
import { UnblockUserDialog } from "@/components/admin/unblock-user-dialog";
import type { AdminUser } from "@/src/domain/admin/admin.types";

interface UsersPageClientProps {
  users: AdminUser[];
  filter?: string;
}

export function UsersPageClient({ users, filter }: UsersPageClientProps) {
  const router = useRouter();
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [subscriptionUser, setSubscriptionUser] = useState<AdminUser | null>(null);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockUser, setBlockUser] = useState<AdminUser | null>(null);
  const [isUnblockDialogOpen, setIsUnblockDialogOpen] = useState(false);
  const [unblockUser, setUnblockUser] = useState<AdminUser | null>(null);

  function handleManageSubscription(user: AdminUser) {
    if (!user.subscription || !user.subscription.stripeSubscriptionId) {
      console.error("User does not have a valid subscription");
      return;
    }
    setSubscriptionUser(user);
    setIsSubscriptionDialogOpen(true);
  }

  function handleBlockUser(user: AdminUser) {
    setBlockUser(user);
    setIsBlockDialogOpen(true);
  }

  function handleUnblockUser(user: AdminUser) {
    setUnblockUser(user);
    setIsUnblockDialogOpen(true);
  }

  function handleSuccess() {
    router.refresh();
  }

  const filterLabel = filter === "all" ? "All Users" :
    filter === "active" ? "Active Subscriptions" :
    filter === "trialing" ? "Trialing Users" :
    filter === "cancelled" ? "Cancelled Subscriptions" :
    filter === "past_due" ? "Past Due Subscriptions" :
    filter === "with_subscription" ? "Users with Subscription" :
    filter === "without_subscription" ? "Users without Subscription" :
    filter === "churn_risk" ? "Churn Risk Users" :
    "All Users";

  return (
    <div className="w-full p-4 lg:p-8">
      <div className="space-y-2 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {filterLabel}
            </h2>
            {filter && (
              <Button
                variant="ghost"
                size="medium"
                onClick={() => router.push("/admin/users")}
                className="mt-1 h-6 text-xs"
              >
                Clear filter
              </Button>
            )}
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users by email, name, or plan..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="pl-9"
              size="medium"
            />
          </div>
        </div>
      </div>
      <UsersTable 
        users={users} 
        loading={false} 
        searchQuery={userSearchQuery} 
        onSearchChange={setUserSearchQuery}
        onManageSubscription={handleManageSubscription}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
      />

      <SubscriptionDialog
        user={subscriptionUser}
        open={isSubscriptionDialogOpen}
        onOpenChange={(open) => {
          setIsSubscriptionDialogOpen(open);
          if (!open) setSubscriptionUser(null);
        }}
        onSuccess={handleSuccess}
      />

      <BlockUserDialog
        user={blockUser}
        open={isBlockDialogOpen}
        onOpenChange={(open) => {
          setIsBlockDialogOpen(open);
          if (!open) setBlockUser(null);
        }}
        onSuccess={handleSuccess}
      />

      <UnblockUserDialog
        user={unblockUser}
        open={isUnblockDialogOpen}
        onOpenChange={(open) => {
          setIsUnblockDialogOpen(open);
          if (!open) setUnblockUser(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
