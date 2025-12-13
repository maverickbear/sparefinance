/**
 * Profile Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseProfile } from "../../domain/profile/profile.types";
import { UserRow } from "@/src/infrastructure/database/repositories/profile.repository";

export class ProfileMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: UserRow): BaseProfile {
    return {
      name: row.name || "",
      email: row.email,
      avatarUrl: row.avatar_url,
      phoneNumber: row.phone_number,
      dateOfBirth: row.date_of_birth,
      temporaryExpectedIncome: (row.temporary_expected_income as import("../../domain/onboarding/onboarding.types").ExpectedIncomeRange) || null,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseProfile>): Partial<UserRow> {
    return {
      name: domain.name || null,
      avatar_url: domain.avatarUrl ?? null,
      phone_number: domain.phoneNumber ?? null,
    };
  }
}

