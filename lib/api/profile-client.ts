"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUserClient, User } from "./auth-client";

export interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

/**
 * Get current user's profile
 */
export async function getProfileClient(): Promise<Profile | null> {
  const user = await getCurrentUserClient();
  
  if (!user) {
    return null;
  }

  return {
    name: user.name || "",
    email: user.email,
    avatarUrl: user.avatarUrl,
    phoneNumber: user.phoneNumber,
  };
}

/**
 * Update user's profile
 */
export async function updateProfileClient(data: Partial<Profile>): Promise<Profile> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw new Error("Not authenticated");
  }

  const updateData: { name?: string; avatarUrl?: string | null; phoneNumber?: string | null } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl || null;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;

  const { data: userData, error: userError } = await supabase
    .from("User")
    .update(updateData)
    .eq("id", authUser.id)
    .select()
    .single();

  if (userError || !userData) {
    console.error("Supabase error updating profile:", userError);
    throw new Error(`Failed to update profile: ${userError?.message || JSON.stringify(userError)}`);
  }

  return {
    name: userData.name || "",
    email: userData.email,
    avatarUrl: userData.avatarUrl || undefined,
    phoneNumber: userData.phoneNumber || undefined,
  };
}

