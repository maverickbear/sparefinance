/**
 * Members Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseHouseholdMember } from "../../domain/members/members.types";
import { HouseholdMemberRow } from "@/src/infrastructure/database/repositories/members.repository";

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
      memberId: row.user_id,
      email: user?.email || row.email || "",
      name: user?.name || row.name || null,
      role: isOwner ? 'admin' : (row.role === 'admin' ? 'admin' : 'member'),
      status: row.status,
      invitationToken: row.invitation_token || "",
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      user_id: domain.memberId ?? null,
      email: domain.email ? domain.email.toLowerCase() : null,
      name: domain.name ?? null,
      role: role as "owner" | "admin" | "member",
      status: domain.status,
      invitation_token: domain.invitationToken || null,
      invited_at: typeof domain.invitedAt === 'string' ? domain.invitedAt : domain.invitedAt?.toISOString() || new Date().toISOString(),
      accepted_at: domain.acceptedAt ? (typeof domain.acceptedAt === 'string' ? domain.acceptedAt : domain.acceptedAt.toISOString()) : null,
      updated_at: typeof domain.updatedAt === 'string' ? domain.updatedAt : domain.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}

