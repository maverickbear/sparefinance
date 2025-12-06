"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { logger } from "@/lib/utils/logger";
import type { BaseUser } from "@/src/domain/auth/auth.types";

interface AuthContextValue {
  user: BaseUser | null;
  isAuthenticated: boolean;
  checking: boolean;
  role: "admin" | "member" | "super_admin" | null;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface InitialData {
  user: BaseUser | null;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
  initialData?: InitialData;
}

/**
 * AuthProvider
 * 
 * Centralized state management for authentication
 * Single source of truth for user authentication status
 * 
 * Features:
 * - Initializes from server data (SSR)
 * - Listens to Supabase auth state changes
 * - Refreshes on app focus/startup
 * - Prevents duplicate fetches
 */
export function AuthProvider({ children, initialData }: AuthProviderProps) {
  const log = logger.withPrefix("AUTH-CONTEXT");
  
  // Initialize state from server data if provided
  const [user, setUser] = useState<BaseUser | null>(initialData?.user ?? null);
  const [isAuthenticated, setIsAuthenticated] = useState(initialData?.isAuthenticated ?? false);
  const [role, setRole] = useState<"admin" | "member" | "super_admin" | null>(null);
  const [checking, setChecking] = useState(false);
  
  const checkingRef = useRef(false);
  const lastFetchRef = useRef<number>(initialData ? Date.now() : 0);
  const roleCacheRef = useRef<{ role: typeof role; timestamp: number } | null>(null);

  const fetchUser = useCallback(async (): Promise<{ user: BaseUser | null; isAuthenticated: boolean; role: typeof role }> => {
    try {
      const [userResponse, roleResponse] = await Promise.all([
        fetch("/api/v2/user"),
        fetch("/api/v2/user/role").catch(() => null), // Role is optional, don't fail if it errors
      ]);
      
      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          log.log("User not authenticated");
          return { user: null, isAuthenticated: false, role: null };
        }
        throw new Error(`Failed to fetch user: ${userResponse.status}`);
      }

      const userData = await userResponse.json();
      const currentUser = userData.user ?? null;
      
      // Fetch role if available
      let userRole: typeof role = null;
      if (roleResponse && roleResponse.ok) {
        try {
          const roleData = await roleResponse.json();
          userRole = roleData.userRole ?? null;
          // Cache role for 5 minutes
          roleCacheRef.current = { role: userRole, timestamp: Date.now() };
        } catch (error) {
          log.warn("Error parsing role data:", error);
        }
      } else if (roleCacheRef.current && (Date.now() - roleCacheRef.current.timestamp) < 5 * 60 * 1000) {
        // Use cached role if available and fresh
        userRole = roleCacheRef.current.role;
      }
      
      return {
        user: currentUser,
        isAuthenticated: !!currentUser,
        role: userRole,
      };
    } catch (error) {
      log.error("Error fetching user:", error);
      return { user: null, isAuthenticated: false, role: null };
    }
  }, [log]);

  const refetch = useCallback(async () => {
    if (checkingRef.current) {
      log.log("Already fetching, skipping");
      return;
    }

    checkingRef.current = true;
    setChecking(true);
    lastFetchRef.current = Date.now();

    try {
      const { user: newUser, isAuthenticated: newIsAuthenticated, role: newRole } = await fetchUser();
      setUser(newUser);
      setIsAuthenticated(newIsAuthenticated);
      setRole(newRole);
    } catch (error) {
      log.error("Error in refetch:", error);
    } finally {
      setChecking(false);
      checkingRef.current = false;
    }
  }, [fetchUser, log]);

  // Listen to Supabase auth state changes
  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: { user?: { id: string } } | null) => {
        log.log("Auth state changed:", event);
        
        if (event === "SIGNED_OUT" || !session?.user) {
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        
        if (session?.user) {
          // Refetch user data to ensure we have latest from database
          await refetch();
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }, [refetch, log]);

  // Check authentication status when app regains focus
  // This handles cases where auth state changes outside the app
  useEffect(() => {
    const handleFocus = () => {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current;
      // Only refetch if it's been at least 1 minute since last fetch
      if (timeSinceLastFetch > 60000) {
        log.log("App regained focus, checking authentication status...");
        refetch();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceLastFetch = Date.now() - lastFetchRef.current;
        if (timeSinceLastFetch > 60000) {
          log.log("Page became visible, checking authentication status...");
          refetch();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch, log]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        checking,
        role,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

/**
 * Safe version of useAuthContext that returns null values when not within provider
 * Useful for components that may be used on public pages
 */
export function useAuthSafe() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      isAuthenticated: false,
      checking: false,
      role: null,
      refetch: async () => {},
    };
  }
  return context;
}

