"use client";

export interface SubscriptionServiceCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  services: SubscriptionService[];
}

export interface SubscriptionService {
  id: string;
  categoryId: string;
  name: string;
  logo: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface SubscriptionServicePlan {
  id: string;
  serviceId: string;
  planName: string;
  price: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all active subscription service categories and services
 */
export async function getSubscriptionServicesClient(): Promise<{
  categories: SubscriptionServiceCategory[];
  services: SubscriptionService[];
}> {
  try {
    const response = await fetch("/api/subscription-services");
    if (!response.ok) {
      throw new Error("Failed to fetch subscription services");
    }
    const data = await response.json();
    return {
      categories: data.categories || [],
      services: data.services || [],
    };
  } catch (error) {
    console.error("Error fetching subscription services:", error);
    return {
      categories: [],
      services: [],
    };
  }
}

/**
 * Get active plans for a subscription service
 */
export async function getSubscriptionServicePlansClient(
  serviceId: string
): Promise<SubscriptionServicePlan[]> {
  try {
    const response = await fetch(
      `/api/subscription-services/plans?serviceId=${encodeURIComponent(serviceId)}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch subscription service plans");
    }
    const data = await response.json();
    return data.plans || [];
  } catch (error) {
    console.error("Error fetching subscription service plans:", error);
    return [];
  }
}

