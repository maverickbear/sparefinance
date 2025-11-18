"use client";

export interface UserServiceSubscription {
  id: string;
  userId: string;
  serviceName: string;
  subcategoryId?: string | null;
  amount: number;
  description?: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number | null;
  accountId: string;
  isActive: boolean;
  firstBillingDate: string;
  createdAt: string;
  updatedAt: string;
  subcategory?: { id: string; name: string; logo?: string | null } | null;
  account?: { id: string; name: string } | null;
}

export interface UserServiceSubscriptionFormData {
  serviceName: string;
  subcategoryId?: string | null;
  amount: number;
  description?: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number | null;
  accountId: string;
  firstBillingDate: Date | string;
  categoryId?: string | null;
  newSubcategoryName?: string | null;
}

/**
 * Get all subscriptions
 */
export async function getUserSubscriptionsClient(): Promise<UserServiceSubscription[]> {
  try {
    const response = await fetch("/api/user-subscriptions");
    if (!response.ok) {
      throw new Error("Failed to fetch subscriptions");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return [];
  }
}

/**
 * Create a new subscription
 */
export async function createUserSubscriptionClient(
  data: UserServiceSubscriptionFormData
): Promise<UserServiceSubscription> {
  const response = await fetch("/api/user-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create subscription");
  }

  return await response.json();
}

/**
 * Update a subscription
 */
export async function updateUserSubscriptionClient(
  id: string,
  data: Partial<UserServiceSubscriptionFormData>
): Promise<UserServiceSubscription> {
  const response = await fetch(`/api/user-subscriptions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update subscription");
  }

  return await response.json();
}

/**
 * Delete a subscription
 */
export async function deleteUserSubscriptionClient(id: string): Promise<void> {
  const response = await fetch(`/api/user-subscriptions/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete subscription");
  }
}

/**
 * Pause a subscription
 */
export async function pauseUserSubscriptionClient(
  id: string
): Promise<UserServiceSubscription> {
  const response = await fetch(`/api/user-subscriptions/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pause" }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to pause subscription");
  }

  return await response.json();
}

/**
 * Resume a subscription
 */
export async function resumeUserSubscriptionClient(
  id: string
): Promise<UserServiceSubscription> {
  const response = await fetch(`/api/user-subscriptions/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resume" }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to resume subscription");
  }

  return await response.json();
}

