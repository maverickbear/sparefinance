"use client";

import { supabase } from "@/lib/supabase";
import { SignUpFormData, SignInFormData } from "@/lib/validations/auth";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";

/**
 * Client-side HIBP password validation
 * Uses k-anonymity approach (only sends first 5 chars of SHA-1 hash)
 */
async function validatePasswordAgainstHIBPClient(
  password: string
): Promise<{ isValid: boolean; error?: string }> {
  // Basic validation
  if (!password || password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  try {
    // Hash the password using SHA-1 (Web Crypto API)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    
    // Get the first 5 characters (prefix) and the rest (suffix)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    // Query HIBP API with only the prefix (k-anonymity)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "User-Agent": "SpareFinance-PasswordCheck/1.0",
        "Add-Padding": "true", // Add padding to prevent timing attacks
      },
    });
    
    if (!response.ok) {
      // If API is unavailable, allow password (fail open)
      console.warn("HIBP API unavailable, skipping password check");
      return { isValid: true };
    }
    
    const responseText = await response.text();
    
    // Check if the suffix (remaining hash) is in the response
    // Response format: SUFFIX:COUNT (one per line)
    const lines = responseText.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const [hashSuffix, count] = trimmedLine.split(":");
      if (hashSuffix === suffix) {
        const breachCount = parseInt(count?.trim() || "0", 10);
        if (breachCount > 0) {
          return {
            isValid: false,
            error: "This password has appeared in a data breach. Please choose a different password.",
          };
        }
      }
    }
    
    return { isValid: true };
  } catch (error) {
    // Fail open - if there's an error, don't block the user
    console.error("Error checking password against HIBP:", error);
    return { isValid: true };
  }
}

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

/**
 * Client-side sign up function
 * Creates user in Supabase Auth and sets up profile
 */
export async function signUpClient(data: SignUpFormData): Promise<{ user: User | null; error: string | null }> {
  try {
    // Check password against HIBP before attempting signup
    const passwordValidation = await validatePasswordAgainstHIBPClient(data.password);
    if (!passwordValidation.isValid) {
      return { user: null, error: passwordValidation.error || "Invalid password" };
    }
    
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

    // Create free subscription for new user
    if (userData) {
      const { error: subscriptionError } = await supabase
        .from("Subscription")
        .insert({
          id: crypto.randomUUID(),
          userId: userData.id,
          planId: "free",
          status: "active",
        });

      if (subscriptionError) {
        console.error("Error creating subscription:", subscriptionError);
      }
    }

    return { user: userData ? mapUser(userData) : null, error: null };
  } catch (error) {
    console.error("Error in signUpClient:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to sign up" };
  }
}

/**
 * Client-side sign in function
 * Signs in user and ensures profile exists
 */
export async function signInClient(data: SignInFormData): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user) {
      // Get user-friendly error message (handles HIBP and other auth errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign in");
      return { user: null, error: errorMessage };
    }

    // Check if email is confirmed
    if (!authData.user.email_confirmed_at) {
      return { user: null, error: "Please confirm your email before signing in. Check your inbox for the confirmation link." };
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
    } else {
      // Ensure user has a free subscription
      const { data: existingSubscription } = await supabase
        .from("Subscription")
        .select("id, planId, status")
        .eq("userId", userData.id)
        .eq("status", "active")
        .single();

      if (!existingSubscription) {
        // Ensure free plan exists
        const { data: existingPlan } = await supabase
          .from("Plan")
          .select("id")
          .eq("id", "free")
          .single();

        if (!existingPlan) {
          // Create free plan if it doesn't exist
          await supabase
            .from("Plan")
            .insert({
              id: "free",
              name: "Free",
              price: 0,
            });
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
    }

    return { user: mapUser(userData), error: null };
  } catch (error) {
    console.error("Error in signInClient:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to sign in" };
  }
}

/**
 * Client-side sign out function
 */
export async function signOutClient(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  } catch (error) {
    console.error("Error in signOutClient:", error);
    return { error: error instanceof Error ? error.message : "Failed to sign out" };
  }
}

/**
 * Get current user from Supabase session
 */
export async function getCurrentUserClient(): Promise<User | null> {
  try {
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
    console.error("Error in getCurrentUserClient:", error);
    return null;
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

