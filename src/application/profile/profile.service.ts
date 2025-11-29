/**
 * Profile Service
 * Business logic for user profile management
 */

import { ProfileRepository } from "@/src/infrastructure/database/repositories/profile.repository";
import { ProfileMapper } from "./profile.mapper";
import { ProfileFormData } from "../../domain/profile/profile.validations";
import { BaseProfile } from "../../domain/profile/profile.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { logger } from "@/src/infrastructure/utils/logger";

export class ProfileService {
  constructor(private repository: ProfileRepository) {}

  /**
   * Get current user profile
   */
  async getProfile(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseProfile | null> {
    try {
      const supabase = await createServerClient(accessToken, refreshToken);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return null;
      }

      const userRow = await this.repository.findById(user.id, accessToken, refreshToken);
      
      if (!userRow) {
        return null;
      }

      return ProfileMapper.toDomain(userRow);
    } catch (error) {
      logger.error("[ProfileService] Error fetching profile:", error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: ProfileFormData): Promise<BaseProfile> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const now = formatTimestamp(new Date());

    // Update user profile
    const userRow = await this.repository.update(user.id, {
      name: data.name || null,
      avatarUrl: data.avatarUrl || null,
      phoneNumber: data.phoneNumber || null,
      updatedAt: now,
    });

    return ProfileMapper.toDomain(userRow);
  }

  /**
   * Update user email (requires re-authentication in Supabase Auth)
   */
  async updateEmail(newEmail: string): Promise<void> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Update email in Auth (this will send confirmation email)
    await this.repository.updateAuthEmail(user.id, newEmail);

    // Note: Email updates should be handled through auth system, not profile service
    // This method is kept for backward compatibility but email is not updated here
    const now = formatTimestamp(new Date());
    await this.repository.update(user.id, {
      updatedAt: now,
    });
  }
}

