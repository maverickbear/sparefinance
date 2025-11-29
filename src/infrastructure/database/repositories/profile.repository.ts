/**
 * Profile Repository
 * Data access layer for user profile - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

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

export class ProfileRepository {
  /**
   * Find user by ID
   */
  async findById(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<UserRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: user, error } = await supabase
      .from("User")
      .select("id, email, name, avatarUrl, phoneNumber, role, createdAt, updatedAt")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[ProfileRepository] Error fetching user:", error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return user as UserRow;
  }

  /**
   * Update user profile
   */
  async update(
    userId: string,
    data: Partial<{
      name: string | null;
      avatarUrl: string | null;
      phoneNumber: string | null;
      updatedAt: string;
    }>
  ): Promise<UserRow> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("User")
      .update(data)
      .eq("id", userId)
      .select("id, email, name, avatarUrl, phoneNumber, role, createdAt, updatedAt")
      .single();

    if (error) {
      logger.error("[ProfileRepository] Error updating user:", error);
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return user as UserRow;
  }

  /**
   * Update email in Supabase Auth
   */
  async updateAuthEmail(userId: string, newEmail: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      logger.error("[ProfileRepository] Error updating auth email:", error);
      throw new Error(`Failed to update email: ${error.message}`);
    }
  }
}

