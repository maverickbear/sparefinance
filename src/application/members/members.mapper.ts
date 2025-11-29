/**
 * Members Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseHouseholdMember } from "../../domain/members/members.types";
import { HouseholdMemberRow } from "../../infrastructure/database/repositories/members.repository";

export class MembersMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(
    row: HouseholdMemberRow,
    ownerId: string,
    user?: { id: string; email: string; name: string | null; avatarUrl?: string | null } | null
  ): BaseHouseholdMember {
    const isOwner = row.role === 'owner';
    
    return {
      id: row.id,
      ownerId,
      memberId: row.userId,
      email: user?.email || row.email || "",
      name: user?.name || row.name || null,
      role: isOwner ? 'admin' : (row.role === 'admin' ? 'admin' : 'member'),
      status: row.status,
      invitationToken: row.invitationToken || "",
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isOwner,
      avatarUrl: user?.avatarUrl || null,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseHouseholdMember>): Partial<HouseholdMemberRow> {
    // Map old role system to new: 'admin' -> 'admin', 'member' -> 'member'
    const role = domain.isOwner ? 'owner' : (domain.role === 'admin' ? 'admin' : 'member');
    
    return {
      id: domain.id,
      userId: domain.memberId ?? null,
      email: domain.email ? domain.email.toLowerCase() : null,
      name: domain.name ?? null,
      role: role as "owner" | "admin" | "member",
      status: domain.status,
      invitationToken: domain.invitationToken || null,
      invitedAt: typeof domain.invitedAt === 'string' ? domain.invitedAt : domain.invitedAt?.toISOString() || new Date().toISOString(),
      acceptedAt: domain.acceptedAt ? (typeof domain.acceptedAt === 'string' ? domain.acceptedAt : domain.acceptedAt.toISOString()) : null,
      updatedAt: typeof domain.updatedAt === 'string' ? domain.updatedAt : domain.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}

