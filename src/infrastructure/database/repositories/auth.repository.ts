/**
 * Auth Repository
 * Data access layer for authentication - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AuthRepository {
  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<UserRow | null> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("User")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[AuthRepository] Error fetching user:", error);
      return null;
    }

    return user as UserRow;
  }

  /**
   * Create user profile
   * Uses service role client to bypass RLS during signup
   */
  async createUser(data: {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
  }): Promise<UserRow> {
    const { createServiceRoleClient } = await import("../supabase-server");
    const serviceRoleClient = createServiceRoleClient();
    const now = formatTimestamp(new Date());

    const { data: user, error } = await serviceRoleClient
      .from("User")
      .insert({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AuthRepository] Error creating user:", error);
      
      // If it's a foreign key constraint error, the user might not exist in auth.users yet
      // This can happen if email confirmation is required or there's a timing issue
      // Don't throw - let the caller handle it gracefully
      if (error.code === '23503') {
        logger.warn("[AuthRepository] User not found in auth.users yet - will be created after email confirmation");
        throw new Error(`User not available in auth.users yet. This is normal if email confirmation is required.`);
      }
      
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return user as UserRow;
  }

  /**
   * Update user profile
   */
  async updateUser(
    userId: string,
    data: Partial<{
      name: string | null;
      avatarUrl: string | null;
      phoneNumber: string | null;
    }>
  ): Promise<UserRow> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("User")
      .update({
        ...data,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      logger.error("[AuthRepository] Error updating user:", error);
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return user as UserRow;
  }

  /**
   * Find multiple users by IDs
   */
  async findUsersByIds(ids: string[]): Promise<UserRow[]> {
    if (ids.length === 0) {
      return [];
    }

    const supabase = await createServerClient();

    const { data: users, error } = await supabase
      .from("User")
      .select("id, email, name")
      .in("id", ids);

    if (error) {
      logger.error("[AuthRepository] Error fetching users by IDs:", error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return (users || []) as UserRow[];
  }

  /**
   * Check for pending invitation
   */
  async findPendingInvitation(email: string): Promise<{ id: string; householdId: string; createdBy: string } | null> {
    const supabase = await createServerClient();

    const { data: invitation, error } = await supabase
      .from("HouseholdMember")
      .select("id, householdId, Household(createdBy)")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (error || !invitation) {
      return null;
    }

    const household = invitation.Household as any;
    return {
      id: invitation.id,
      householdId: invitation.householdId,
      createdBy: household?.createdBy || "",
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserRow | null> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("User")
      .select("id, email, name")
      .eq("email", email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[AuthRepository] Error fetching user by email:", error);
      return null;
    }

    return user as UserRow;
  }

  /**
   * Find users created between dates (for batch operations)
   */
  async findUsersByDateRange(startDate: Date, endDate: Date): Promise<UserRow[]> {
    const { createServiceRoleClient } = await import("../supabase-server");
    const serviceRoleClient = createServiceRoleClient();

    const { data: users, error } = await serviceRoleClient
      .from("User")
      .select("id, email, name, createdAt")
      .gte("createdAt", startDate.toISOString())
      .lte("createdAt", endDate.toISOString())
      .order("createdAt", { ascending: false });

    if (error) {
      logger.error("[AuthRepository] Error fetching users by date range:", error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return (users || []) as UserRow[];
  }
}

