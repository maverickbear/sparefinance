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
  avatar_url: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  temporary_expected_income: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
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
      .from("users")
      .select("id, email, name, avatar_url, phone_number, date_of_birth, temporary_expected_income, role, created_at, updated_at")
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
      dateOfBirth: string | null;
      temporaryExpectedIncome: string | null;
      updatedAt: string;
    }>
  ): Promise<UserRow> {
    const supabase = await createServerClient();

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
    if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber;
    if (data.dateOfBirth !== undefined) updateData.date_of_birth = data.dateOfBirth;
    if (data.temporaryExpectedIncome !== undefined) updateData.temporary_expected_income = data.temporaryExpectedIncome;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: user, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select("id, email, name, avatar_url, phone_number, date_of_birth, temporary_expected_income, role, created_at, updated_at")
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

