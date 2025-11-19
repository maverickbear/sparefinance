"use client";

import { supabase } from "@/lib/supabase";
import { SignUpFormData, SignInFormData, ForgotPasswordFormData, ResetPasswordFormData } from "@/lib/validations/auth";
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

    // Check if email has a pending invitation
    try {
      const checkResponse = await fetch(`/api/members/invite/check-pending?email=${encodeURIComponent(data.email)}`);
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.hasPendingInvitation) {
          return { 
            user: null, 
            error: "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account." 
          };
        }
      }
    } catch (checkError) {
      // If check fails, continue with signup (don't block)
      console.error("Error checking pending invitation:", checkError);
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

    // During signup, the session might not be fully established yet, which can cause
    // RLS policy violations when trying to insert directly. Always use the API route
    // which uses service role and bypasses RLS for more reliable user creation.
    let userData;
          
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
        // If API route fails, try to fetch existing user (might have been created by a trigger)
        console.warn("[SIGNUP] API route failed, checking if user already exists:", createData.error || "Unknown error");
        
        const { data: existingUser, error: fetchError } = await supabase
          .from("User")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();
        
        if (existingUser) {
          console.log("[SIGNUP] User profile already exists, using existing profile");
          userData = existingUser;
        } else if (fetchError) {
          console.warn("[SIGNUP] Error fetching existing user:", fetchError.message || fetchError);
            // User is created in auth but not in User table - this is OK, will be created on first login
          }
        } 
    } catch (apiError) {
      console.error("[SIGNUP] ❌ Error calling create-user-profile API:", apiError);
          
      // Fallback: try to fetch existing user
      const { data: existingUser, error: fetchError } = await supabase
            .from("User")
            .select("*")
            .eq("id", authData.user.id)
        .maybeSingle();
          
          if (existingUser) {
        console.log("[SIGNUP] User profile already exists (fallback), using existing profile");
            userData = existingUser;
      } else if (fetchError) {
        console.warn("[SIGNUP] Error fetching existing user (fallback):", fetchError.message || fetchError);
        // User is created in auth but not in User table - this is OK, will be created on first login
      }
    }

    // Create household member record for the owner (owner is also a household member of themselves)
    // Use API route to avoid RLS issues during signup (session might not be fully established)
    if (userData) {
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
          // Don't fail signup if household member creation fails, but log it
          console.warn("[SIGNUP] ❌ API route failed for household member:", createData.error || "Unknown error");
        }
      } catch (apiError) {
        // Don't fail signup if household member creation fails, but log it
        console.error("[SIGNUP] ❌ Error calling create-household-member API:", apiError);
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

/**
 * Client-side request password reset function
 * Sends password reset email via Supabase
 */
export async function requestPasswordResetClient(data: ForgotPasswordFormData): Promise<{ error: string | null }> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = `${appUrl}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });

    if (error) {
      // Don't reveal if email exists or not for security
      // Always return success message to prevent email enumeration
      console.error("Error requesting password reset:", error);
      return { error: null }; // Return success even on error to prevent enumeration
    }

    return { error: null };
  } catch (error) {
    console.error("Error in requestPasswordResetClient:", error);
    // Return success to prevent email enumeration
    return { error: null };
  }
}

/**
 * Client-side reset password function
 * Updates user password after validating with HIBP
 */
export async function resetPasswordClient(data: ResetPasswordFormData): Promise<{ error: string | null }> {
  try {
    // Validate password against HIBP before attempting reset
    const passwordValidation = await validatePasswordAgainstHIBPClient(data.password);
    if (!passwordValidation.isValid) {
      return { error: passwordValidation.error || "Invalid password" };
    }

    // Update user password
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      const errorMessage = getAuthErrorMessage(error, "Failed to reset password");
      return { error: errorMessage };
    }

    return { error: null };
  } catch (error) {
    console.error("Error in resetPasswordClient:", error);
    return { error: error instanceof Error ? error.message : "Failed to reset password" };
  }
}

/**
 * Sign in with Google OAuth
 * Initiates OAuth flow and redirects to Google
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = `${appUrl}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("Error initiating Google OAuth:", error);
      return { error: error.message || "Failed to sign in with Google" };
    }

    // The redirect will happen automatically, so we return success
    return { error: null };
  } catch (error) {
    console.error("Error in signInWithGoogle:", error);
    return { error: error instanceof Error ? error.message : "Failed to sign in with Google" };
  }
}

/**
 * Create user profile from OAuth authentication
 * This is called after OAuth callback to ensure user profile exists
 */
export async function createUserProfileFromOAuth(): Promise<{ user: User | null; error: string | null; isNewUser: boolean }> {
  try {
    // Get the authenticated user from Supabase
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { user: null, error: "Not authenticated", isNewUser: false };
    }

    // Check if email has a pending invitation
    try {
      const checkResponse = await fetch(`/api/members/invite/check-pending?email=${encodeURIComponent(authUser.email || "")}`);
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.hasPendingInvitation) {
          return { 
            user: null, 
            error: "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account.",
            isNewUser: false
          };
        }
      }
    } catch (checkError) {
      // If check fails, continue (don't block)
      console.error("Error checking pending invitation:", checkError);
    }

    // Extract user data from OAuth metadata
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || null;
    const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;

    // Check if user profile already exists
    let { data: userData } = await supabase
      .from("User")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    const isNewUser = !userData;

    if (!userData) {
      // Create user profile using API route (bypasses RLS)
      try {
        const createResponse = await fetch("/api/auth/create-user-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: authUser.id,
            email: authUser.email,
            name: name,
            avatarUrl: avatarUrl,
          }),
        });

        const createData = await createResponse.json();

        if (createResponse.ok && createData.user) {
          console.log("[OAUTH] ✅ User profile created via API route");
          userData = createData.user;
        } else {
          // Fallback: try to fetch existing user (might have been created by a trigger)
          console.warn("[OAUTH] API route failed, checking if user already exists:", createData.error || "Unknown error");
          
          const { data: existingUser } = await supabase
            .from("User")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();
          
          if (existingUser) {
            console.log("[OAUTH] User profile already exists, using existing profile");
            userData = existingUser;
          } else {
            return { user: null, error: "Failed to create user profile", isNewUser: true };
          }
        }
      } catch (apiError) {
        console.error("[OAUTH] ❌ Error calling create-user-profile API:", apiError);
        
        // Fallback: try to fetch existing user
        const { data: existingUser } = await supabase
          .from("User")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();
        
        if (existingUser) {
          console.log("[OAUTH] User profile already exists (fallback), using existing profile");
          userData = existingUser;
        } else {
          return { user: null, error: "Failed to create user profile", isNewUser: true };
        }
      }

      // Create household member record for the owner (owner is also a household member of themselves)
      if (userData) {
        try {
          const createResponse = await fetch("/api/auth/create-household-member", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ownerId: userData.id,
              memberId: userData.id,
              email: authUser.email!,
              name: name,
            }),
          });

          const createData = await createResponse.json();

          if (createResponse.ok && createData.success) {
            console.log("[OAUTH] ✅ Household member created via API route");
          } else {
            console.warn("[OAUTH] ❌ API route failed for household member:", createData.error || "Unknown error");
          }
        } catch (apiError) {
          console.error("[OAUTH] ❌ Error calling create-household-member API:", apiError);
        }
      }
    } else {
      // User already exists - update avatar if available and not set
      if (avatarUrl && !userData.avatarUrl) {
        try {
          const { data: updatedUser } = await supabase
            .from("User")
            .update({ avatarUrl: avatarUrl })
            .eq("id", authUser.id)
            .select()
            .single();
          
          if (updatedUser) {
            userData = updatedUser;
          }
        } catch (updateError) {
          console.warn("[OAUTH] Error updating avatar:", updateError);
        }
      }
    }

    // Check if there's a pending subscription for this email and link it automatically
    if (userData && authUser.email) {
      try {
        // Wait a bit for the user record to be fully created
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to link any pending subscription
        const linkResponse = await fetch("/api/stripe/link-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: authUser.email }),
        });

        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          if (linkData.success) {
            console.log("[OAUTH] Pending subscription linked automatically:", authUser.email);
          }
        }
        // If linking fails, it's OK - user can still use the app normally
      } catch (error) {
        console.error("[OAUTH] Error linking pending subscription:", error);
        // Don't fail if linking fails
      }
    }

    return { user: userData ? mapUser(userData) : null, error: null, isNewUser };
  } catch (error) {
    console.error("Error in createUserProfileFromOAuth:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to create user profile", isNewUser: false };
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

