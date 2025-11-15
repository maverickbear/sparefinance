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
    
    // Create abort controller for timeout (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
    // Query HIBP API with only the prefix (k-anonymity)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "User-Agent": "SpareFinance-PasswordCheck/1.0",
        "Add-Padding": "true", // Add padding to prevent timing attacks
      },
        signal: controller.signal,
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
    } finally {
      // Always clear the timeout
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Fail open - if there's an error, don't block the user
    // Only log warnings for network errors (expected when offline or API is down)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.warn("HIBP API check failed (network error), allowing password");
    } else if (error instanceof Error && error.name === "AbortError") {
      console.warn("HIBP API check timed out, allowing password");
    } else {
      console.warn("HIBP API check failed, allowing password:", error);
    }
    return { isValid: true };
  }
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  role?: "admin" | "member" | "super_admin";
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
    // Note: Supabase will automatically send OTP email if email confirmation is enabled
    // We'll redirect to OTP verification page after signup
    // Use both 'name' and 'full_name' for compatibility with Supabase Auth Display name
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")}/auth/verify-otp?email=${encodeURIComponent(data.email)}`,
        data: {
          name: data.name || "",
          full_name: data.name || "",
        },
      },
    });

    // If signup is successful but user needs email confirmation, 
    // Supabase will send OTP automatically. If not, we'll resend it on the OTP page.

    if (authError || !authData.user) {
      // Get user-friendly error message (handles HIBP errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign up");
      return { user: null, error: errorMessage };
    }

    // Wait a moment for the session to be established (needed for RLS policies)
    // This ensures auth.uid() is available when we try to insert
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if user profile already exists
    let { data: userData, error: fetchError } = await supabase
      .from("User")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (fetchError) {
      console.warn("[SIGNUP] Error checking existing user:", fetchError.message || fetchError);
    }

    // If user doesn't exist, create it
    if (!userData) {
      const { data: newUserData, error: userError } = await supabase
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
        // Log detailed error information with better error handling
        const errorDetails = {
          message: userError.message || "Unknown error",
          details: userError.details || null,
          hint: userError.hint || null,
          code: userError.code || null,
          userId: authData.user.id,
          email: authData.user.email,
        };
        
        console.error("[SIGNUP] Error creating user profile:", JSON.stringify(errorDetails, null, 2));
        
        // Check for RLS error first (most common during signup)
        const isRLSError = userError.code === "42501" || 
                          userError.code === "PGRST301" ||
                          (userError.message && (
                            userError.message.toLowerCase().includes("row-level security") ||
                            userError.message.toLowerCase().includes("policy") ||
                            userError.message.toLowerCase().includes("violates")
                          ));
        
        // Check for duplicate key error
        const isDuplicateError = userError.code === "23505" || 
                                 (userError.message && (
                                   userError.message.includes("duplicate") || 
                                   userError.message.includes("unique") ||
                                   userError.message.includes("already exists")
                                 ));
        
        if (isRLSError) {
          console.log("[SIGNUP] RLS error detected (code:", userError.code, "), trying API route with service role...");
          
          try {
            const createResponse = await fetch("/api/auth/create-user-profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: authData.user.id,
                email: authData.user.email,
                name: data.name || null,
              }),
            });

            const createData = await createResponse.json();

            if (createResponse.ok && createData.user) {
              console.log("[SIGNUP] ✅ User profile created via API route");
              userData = createData.user;
            } else {
              console.warn("[SIGNUP] ❌ API route failed:", createData.error || "Unknown error");
              // User is created in auth but not in User table - this is OK, will be created on first login
            }
          } catch (apiError) {
            console.error("[SIGNUP] ❌ Error calling create-user-profile API:", apiError);
            // User is created in auth but not in User table - this is OK, will be created on first login
          }
        } 
        // If it's a duplicate key error, try to fetch the existing user
        else if (isDuplicateError) {
          console.log("[SIGNUP] User already exists, fetching existing user...");
          
          // Retry fetching the user (may have been created by a trigger or race condition)
          const { data: existingUser, error: retryError } = await supabase
            .from("User")
            .select("*")
            .eq("id", authData.user.id)
            .single();
          
          if (existingUser) {
            console.log("[SIGNUP] Successfully fetched existing user");
            userData = existingUser;
          } else if (retryError) {
            console.warn("[SIGNUP] Error fetching existing user:", retryError.message || retryError);
          }
        } else {
          console.warn("[SIGNUP] Unknown error type, not attempting fallback");
        }
        // User is created in auth but not in User table - this is OK, will be created on first login
      } else {
        userData = newUserData;
      }
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
          // Log detailed error information
          const errorDetails = {
            message: householdMemberError.message || "Unknown error",
            details: householdMemberError.details || null,
            hint: householdMemberError.hint || null,
            code: householdMemberError.code || null,
            ownerId: userData.id,
            memberId: userData.id,
            email: authData.user.email,
          };
          
          console.error("[SIGNUP] Error creating household member record:", JSON.stringify(errorDetails, null, 2));
          
          // Check for RLS error
          const isRLSError = householdMemberError.code === "42501" || 
                            householdMemberError.code === "PGRST301" ||
                            (householdMemberError.message && (
                              householdMemberError.message.toLowerCase().includes("row-level security") ||
                              householdMemberError.message.toLowerCase().includes("policy") ||
                              householdMemberError.message.toLowerCase().includes("violates")
                            ));
          
          if (isRLSError) {
            console.log("[SIGNUP] RLS error detected for household member (code:", householdMemberError.code, "), trying API route...");
            
            try {
              const createResponse = await fetch("/api/auth/create-household-member", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  ownerId: userData.id,
                  memberId: userData.id,
                  email: authData.user.email!,
                  name: data.name || null,
                }),
              });

              const createData = await createResponse.json();

              if (createResponse.ok && createData.success) {
                console.log("[SIGNUP] ✅ Household member created via API route");
              } else {
                console.warn("[SIGNUP] ❌ API route failed for household member:", createData.error || "Unknown error");
              }
            } catch (apiError) {
              console.error("[SIGNUP] ❌ Error calling create-household-member API:", apiError);
            }
          } else {
            console.warn("[SIGNUP] Unknown error type for household member, not attempting fallback");
          }
          // Don't fail signup if household member creation fails, but log it
        }
      }
    }

    // Check if there's a pending subscription for this email and link it automatically
    if (userData && authData.user.email) {
      try {
        // Wait a bit for the user record to be fully created
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to link any pending subscription
        const linkResponse = await fetch("/api/stripe/link-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: authData.user.email }),
        });

        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          if (linkData.success) {
            console.log("[SIGNUP] Pending subscription linked automatically:", authData.user.email);
          }
        }
        // If linking fails, it's OK - user can still use the app normally
      } catch (error) {
        console.error("[SIGNUP] Error linking pending subscription:", error);
        // Don't fail signup if linking fails
      }
    }

    // Note: Subscription is NOT created automatically during signup (unless there's a pending one)
    // User must select a plan on /select-plan page if they don't have one
    // This allows users to choose their plan before being redirected to dashboard

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

      // Note: Subscription is NOT created automatically during signin
      // User must select a plan on /select-plan page if they don't have one
    } else {
      // User already exists - no need to create subscription
      // If they don't have one, they'll be redirected to /select-plan
    }

    return { user: mapUser(userData), error: null };
  } catch (error) {
    console.error("Error in signInClient:", error);
    
    // Handle network/connectivity errors specifically
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      // Check if Supabase environment variables are configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return { 
          user: null, 
          error: "Configuration error: Supabase credentials are missing. Please check your environment variables." 
        };
      }
      
      return { 
        user: null, 
        error: "Network error: Unable to connect to the authentication server. Please check your internet connection and try again." 
      };
    }
    
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
 * Also verifies that the user exists in the User table
 * If user doesn't exist, logs out and returns null
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

    // If user doesn't exist in User table, logout and return null
    if (userError || !userData) {
      console.warn(`[getCurrentUserClient] User ${authUser.id} authenticated but not found in User table. Logging out.`);
      
      // Logout to clear session
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("[getCurrentUserClient] Error signing out:", signOutError);
      }
      
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
    dateOfBirth: data.dateOfBirth || undefined,
    role: data.role || "admin", // Default to admin if not set
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

