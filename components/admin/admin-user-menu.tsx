"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthSafe } from "@/contexts/auth-context";
import { getInitials, isValidAvatarUrl } from "@/lib/utils/avatar";
import { logger } from "@/src/infrastructure/utils/logger";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Admin user menu: avatar card with name; click opens dropdown with Log out.
 * Uses AuthContext (same as dashboard); /api/v2/user returns admin name/email for super_admin.
 */
export function AdminUserMenu() {
  const router = useRouter();
  const { user, checking } = useAuthSafe();
  const log = logger.withPrefix("ADMIN-USER-MENU");

  const [mounted, setMounted] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const avatarUrl = useMemo(() => user?.avatarUrl, [user?.avatarUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAvatarImageError(false);
  }, [avatarUrl]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/v2/auth/sign-out", { method: "POST" });
      router.push("/");
      window.location.href = "/";
    } catch (error) {
      log.error("Error signing out:", error);
      router.push("/");
      window.location.href = "/";
    }
  }, [router, log]);

  if (!mounted || checking) {
    return (
      <div className="mt-auto p-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-2 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="medium"
            className="w-full h-auto p-2 border border-border shadow hover:bg-secondary justify-start rounded-lg"
          >
            <div className="flex items-center w-full gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                {user && isValidAvatarUrl(user.avatarUrl) && !avatarImageError ? (
                  <img
                    src={user.avatarUrl!}
                    alt={user.name || "User"}
                    className="h-10 w-10 rounded-full object-cover border"
                    loading="eager"
                    decoding="async"
                    onError={() => setAvatarImageError(true)}
                    onLoad={() => setAvatarImageError(false)}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold border">
                    {getInitials(user?.name)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">
                  {user?.name ?? "Admin"}
                </div>
                {user?.email && (
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                )}
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
