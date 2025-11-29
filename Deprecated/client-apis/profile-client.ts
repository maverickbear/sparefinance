"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUserClient, User } from "./auth-client";

export interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
}

/**
 * Get current user's profile
 * Optimized: Reuses getUserClient data if available to avoid duplicate query
 */
export async function getProfileClient(): Promise<Profile | null> {
  // Try to get from cache first (if getUserClient was called)
  if (typeof window !== 'undefined' && (window as any).navUserDataCache?.data?.user) {
    const cachedUser = (window as any).navUserDataCache.data.user;
    return {
      name: cachedUser.name || "",
      email: cachedUser.email,
      avatarUrl: cachedUser.avatarUrl,
      phoneNumber: cachedUser.phoneNumber,
      dateOfBirth: cachedUser.dateOfBirth,
    };
  }

  // Fallback to fetching user data
  const user = await getCurrentUserClient();
  
  if (!user) {
    return null;
  }

  return {
    name: user.name || "",
    email: user.email,
    avatarUrl: user.avatarUrl,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth,
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

  const updateData: { name?: string; avatarUrl?: string | null; phoneNumber?: string | null; dateOfBirth?: string | null } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl || null;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth || null;

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
    dateOfBirth: userData.dateOfBirth || undefined,
  };
}

/**
 * Delete user account
 * Requires password confirmation
 */
export async function deleteAccountClient(password: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch("/api/profile/delete-account", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to delete account");
  }

  return data;
}


