/**
 * Subscription Services Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import {
  BaseSubscriptionServiceCategory,
  BaseSubscriptionService,
  BaseSubscriptionServicePlan,
} from "../../domain/subscription-services/subscription-services.types";
import {
  SubscriptionServiceCategoryRow,
  SubscriptionServiceRow,
  SubscriptionServicePlanRow,
} from "@/src/infrastructure/database/repositories/subscription-services.repository";

export class SubscriptionServicesMapper {
  /**
   * Map repository row to domain entity
   */
  static categoryToDomain(row: SubscriptionServiceCategoryRow): BaseSubscriptionServiceCategory {
    return {
      id: row.id,
      name: row.name,
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map repository row to domain entity
   */
  static serviceToDomain(row: SubscriptionServiceRow): BaseSubscriptionService {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      logo: row.logo,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map repository row to domain entity
   */
  static planToDomain(row: SubscriptionServicePlanRow): BaseSubscriptionServicePlan {
    return {
      id: row.id,
      serviceId: row.service_id,
      planName: row.plan_name,
      price: row.price,
      currency: row.currency,
      billingCycle: "monthly", // Default to monthly - column doesn't exist in DB yet
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

