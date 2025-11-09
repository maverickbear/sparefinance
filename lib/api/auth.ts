"use server";

import { createServerClient } from "@/lib/supabase-server";
import { SignUpFormData, SignInFormData } from "@/lib/validations/auth";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { cookies } from "next/headers";

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  role?: "admin" | "member";
  createdAt: Date;
  updatedAt: Date;
}

export async function signUp(data: SignUpFormData): Promise<{ user: User | null; error: string | null }> {
  try {
    // Check password against HIBP before attempting signup
    const passwordValidation = await validatePasswordAgainstHIBP(data.password);
    if (!passwordValidation.isValid) {
      return { user: null, error: passwordValidation.error || "Invalid password" };
    }
    
    const supabase = await createServerClient();
    
    // Sign up user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name || "",
        },
      },
    });

    if (authError || !authData.user) {
      // Get user-friendly error message (handles HIBP errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign up");
      return { user: null, error: errorMessage };
    }

    // Create user profile in User table (owners sign up directly, so they are admin)
    const { data: userData, error: userError } = await supabase
      .from("User")
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        name: data.name || null,
        role: "admin", // Owners who sign up directly are admins
      })
      .select()
      .single();

    if (userError) {
      console.error("Error creating user profile:", userError);
      // User is created in auth but not in User table - this is OK, will be created on first login
    }

    // Create household member record for the owner (owner is also a household member of themselves)
    if (userData) {
      const invitationToken = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Check if household member already exists (should not happen, but safety check)
      const { data: existingMember } = await supabase
        .from("HouseholdMember")
        .select("id")
        .eq("ownerId", userData.id)
        .eq("memberId", userData.id)
        .maybeSingle();

      if (!existingMember) {
        const { error: householdMemberError } = await supabase
          .from("HouseholdMember")
          .insert({
            ownerId: userData.id,
            memberId: userData.id,
            email: authData.user.email!,
            name: data.name || null,
            role: "admin", // Owner is admin
            status: "active", // Owner is immediately active
            invitationToken: invitationToken,
            invitedAt: now,
            acceptedAt: now, // Owner accepts immediately
            createdAt: now,
            updatedAt: now,
          });

        if (householdMemberError) {
          console.error("Error creating household member record:", householdMemberError);
          // Don't fail signup if household member creation fails, but log it
        }
      }
    }

    // Note: Subscription is NOT created automatically during signup
    // User must select a plan on /select-plan page
    // This allows users to choose their plan before being redirected to dashboard

    return { user: userData ? mapUser(userData) : null, error: null };
  } catch (error) {
    console.error("Error in signUp:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to sign up" };
  }
}

export async function signIn(data: SignInFormData): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = await createServerClient();
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user) {
      // Get user-friendly error message (handles HIBP and other auth errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign in");
      return { user: null, error: errorMessage };
    }

    // Get or create user profile
    let { data: userData } = await supabase
      .from("User")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (!userData) {
      // Create user profile if it doesn't exist (owners who sign in directly are admins)
      const { data: newUser, error: userError } = await supabase
        .from("User")
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || null,
          role: "admin", // Owners who sign in directly are admins
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("Error creating user profile:", userError);
        return { user: null, error: "Failed to create user profile" };
      }

      userData = newUser;

      // Create household member record for the owner (owner is also a household member of themselves)
      const invitationToken = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Check if household member already exists (should not happen, but safety check)
      const { data: existingMember } = await supabase
        .from("HouseholdMember")
        .select("id")
        .eq("ownerId", userData.id)
        .eq("memberId", userData.id)
        .maybeSingle();

      if (!existingMember) {
        const { error: householdMemberError } = await supabase
          .from("HouseholdMember")
          .insert({
            ownerId: userData.id,
            memberId: userData.id,
            email: authData.user.email!,
            name: authData.user.user_metadata?.name || null,
            role: "admin", // Owner is admin
            status: "active", // Owner is immediately active
            invitationToken: invitationToken,
            invitedAt: now,
            acceptedAt: now, // Owner accepts immediately
            createdAt: now,
            updatedAt: now,
          });

        if (householdMemberError) {
          console.error("Error creating household member record:", householdMemberError);
          // Don't fail signin if household member creation fails, but log it
        }
      }

      // Create free subscription
      await supabase
        .from("Subscription")
        .insert({
          id: crypto.randomUUID(),
          userId: userData.id,
          planId: "free",
          status: "active",
        });
    }

    return { user: mapUser(userData), error: null };
  } catch (error) {
    console.error("Error in signIn:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to sign in" };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  } catch (error) {
    console.error("Error in signOut:", error);
    return { error: error instanceof Error ? error.message : "Failed to sign out" };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      return null;
    }

    return mapUser(userData);
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}

export async function updateProfile(data: { name?: string; avatarUrl?: string; phoneNumber?: string }): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { user: null, error: "Not authenticated" };
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
      return { user: null, error: userError?.message || "Failed to update profile" };
    }

    return { user: mapUser(userData), error: null };
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to update profile" };
  }
}

function mapUser(data: any): User {
  return {
    id: data.id,
    email: data.email,
    name: data.name || undefined,
    avatarUrl: data.avatarUrl || undefined,
    phoneNumber: data.phoneNumber || undefined,
    role: data.role || "admin", // Default to admin if not set
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

