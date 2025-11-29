"use server";

import { ProfileFormData } from "@/src/domain/profile/profile.validations";
import { getCurrentUser, updateProfile as updateUserProfile } from "@/lib/api/auth";

export interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

// Fetch profile from Supabase
export async function getProfile(): Promise<Profile | null> {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return null;
    }

    return {
      name: user.name || "",
      email: user.email,
      avatarUrl: user.avatarUrl,
      phoneNumber: user.phoneNumber,
    };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}

export async function updateProfile(data: ProfileFormData): Promise<Profile> {
  const { user, error } = await updateUserProfile({
    name: data.name,
    avatarUrl: data.avatarUrl || undefined,
    phoneNumber: data.phoneNumber || undefined,
  });

  if (error || !user) {
    throw new Error(error || "Failed to update profile");
  }

  return {
    name: user.name || "",
    email: user.email,
    avatarUrl: user.avatarUrl,
    phoneNumber: user.phoneNumber,
  };
}

