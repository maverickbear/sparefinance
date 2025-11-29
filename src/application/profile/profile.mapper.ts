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
      avatarUrl: row.avatarUrl,
      phoneNumber: row.phoneNumber,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseProfile>): Partial<UserRow> {
    return {
      name: domain.name || null,
      avatarUrl: domain.avatarUrl ?? null,
      phoneNumber: domain.phoneNumber ?? null,
    };
  }
}

