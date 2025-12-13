/**
 * Subscription Services Repository
 * Data access layer for subscription services - only handles database operations
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import {
  BaseSubscriptionServiceCategory,
  BaseSubscriptionService,
  BaseSubscriptionServicePlan,
} from "@/src/domain/subscription-services/subscription-services.types";

export interface SubscriptionServiceCategoryRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionServiceRow {
  id: string;
  name: string;
  category_id: string;
  logo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionServicePlanRow {
  id: string;
  service_id: string;
  plan_name: string;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class SubscriptionServicesRepository {
  /**
   * Get all active categories
   */
  async findAllActiveCategories(): Promise<SubscriptionServiceCategoryRow[]> {
    const supabase = await createServerClient();

    const { data: categories, error } = await supabase
      .from("external_service_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      logger.error("[SubscriptionServicesRepository] Error fetching categories:", error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    return (categories || []) as SubscriptionServiceCategoryRow[];
  }

  /**
   * Get all active services
   */
  async findAllActiveServices(): Promise<SubscriptionServiceRow[]> {
    const supabase = await createServerClient();

    const { data: services, error } = await supabase
      .from("external_services")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[SubscriptionServicesRepository] Error fetching services:", error);
      throw new Error(`Failed to fetch services: ${error.message}`);
    }

    return (services || []) as SubscriptionServiceRow[];
  }

  /**
   * Get active plans for a service
   */
  async findActivePlansByServiceId(serviceId: string): Promise<SubscriptionServicePlanRow[]> {
    const supabase = await createServerClient();

    const { data: plans, error } = await supabase
      .from("external_service_plans")
      .select("*")
      .eq("service_id", serviceId)
      .eq("is_active", true)
      .order("plan_name", { ascending: true });

    if (error) {
      logger.error("[SubscriptionServicesRepository] Error fetching plans:", error);
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    return (plans || []) as SubscriptionServicePlanRow[];
  }

  /**
   * Find services by names
   */
  async findServicesByNames(names: string[]): Promise<SubscriptionServiceRow[]> {
    if (names.length === 0) {
      return [];
    }

    const supabase = await createServerClient();

    const { data: services, error } = await supabase
      .from("external_services")
      .select("name, logo")
      .in("name", names);

    if (error) {
      logger.error("[SubscriptionServicesRepository] Error fetching services by names:", error);
      throw new Error(`Failed to fetch services: ${error.message}`);
    }

    return (services || []) as SubscriptionServiceRow[];
  }
}

