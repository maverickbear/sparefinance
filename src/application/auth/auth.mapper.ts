/**
 * Auth Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseUser } from "../../domain/auth/auth.types";
import { UserRow } from "@/src/infrastructure/database/repositories/auth.repository";

export class AuthMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: UserRow): BaseUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      phoneNumber: row.phoneNumber,
      role: row.role as "admin" | "member" | "super_admin" | undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseUser>): Partial<UserRow> {
    return {
      id: domain.id,
      email: domain.email,
      name: domain.name ?? null,
      avatarUrl: domain.avatarUrl ?? null,
      phoneNumber: domain.phoneNumber ?? null,
      role: domain.role ?? null,
    };
  }
}

