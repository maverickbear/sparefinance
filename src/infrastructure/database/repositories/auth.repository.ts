/**
 * Auth Repository
 * Data access layer for authentication - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { IAuthRepository } from "./interfaces/auth.repository.interface";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

export class AuthRepository implements IAuthRepository {
  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<UserRow | null> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("users")
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
   * Includes retry logic to handle timing issues with auth.users synchronization
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

    // Retry logic to handle timing issues with auth.users synchronization
    const maxRetries = 3;
    const retryDelay = 500; // 500ms initial delay
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Before attempting insert on retry, verify user exists in auth.users
      // This helps catch timing issues early
      if (attempt > 0) {
        try {
          // Check if auth.admin API is available (may not be in all Supabase versions)
          if (serviceRoleClient.auth?.admin?.getUserById) {
            const { data: authUser, error: authError } = await serviceRoleClient.auth.admin.getUserById(data.id);
            if (authError || !authUser) {
              logger.warn(`[AuthRepository] User ${data.id} not found in auth.users (attempt ${attempt + 1}/${maxRetries})`);
              if (attempt < maxRetries - 1) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                continue;
              } else {
                throw new Error(`User not available in auth.users after ${maxRetries} attempts. This may indicate an issue with user creation.`);
              }
            }
          }
        } catch (checkError) {
          // If admin API is not available or fails, continue with insert attempt
          // The insert will fail with foreign key error if user doesn't exist
          logger.warn(`[AuthRepository] Could not verify user in auth.users (attempt ${attempt + 1}/${maxRetries}), proceeding with insert:`, checkError);
        }
      }

      const { data: user, error } = await serviceRoleClient
        .from("users")
        .insert({
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        const errorCode = (error as any)?.code;
        
        // Check if error is due to unique constraint violation (duplicate email)
        if (errorCode === '23505') {
          logger.error("[AuthRepository] Error creating user (duplicate email):", error);
          const uniqueError = new Error("An account with this email already exists");
          (uniqueError as any).code = '23505';
          throw uniqueError;
        }
        
        // If it's a foreign key constraint error, retry if we haven't exhausted attempts
        if (errorCode === '23503') {
          logger.warn(`[AuthRepository] Foreign key constraint error (attempt ${attempt + 1}/${maxRetries}): User not found in auth.users yet`);
          
          if (attempt < maxRetries - 1) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
            continue;
          } else {
            // After all retries, throw a clear error
            logger.error("[AuthRepository] User not found in auth.users after all retries - will be created after email confirmation");
            throw new Error(`User not available in auth.users yet. This is normal if email confirmation is required.`);
          }
        }
        
        // For other errors, throw immediately
        logger.error("[AuthRepository] Error creating user:", error);
        throw new Error(`Failed to create user: ${error.message}`);
      }

      // Success - return the created user
      return user as UserRow;
    }

    // This should never be reached, but TypeScript requires it
    throw new Error(`Failed to create user after ${maxRetries} attempts`);
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

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
    if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber;
    updateData.updated_at = formatTimestamp(new Date());

    const { data: user, error } = await supabase
      .from("users")
      .update(updateData)
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
      .from("users")
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
      .from("household_members")
      .select("id, household_id, household:households(created_by)")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (error || !invitation) {
      return null;
    }

    const household = invitation.household as any;
    return {
      id: invitation.id,
      householdId: invitation.household_id,
      createdBy: household?.created_by || "",
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserRow | null> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("users")
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
      .from("users")
      .select("id, email, name, created_at")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[AuthRepository] Error fetching users by date range:", error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return (users || []) as UserRow[];
  }
}

