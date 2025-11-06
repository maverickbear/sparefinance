"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Receipt, Target, FolderTree, Wallet, TrendingUp, FileText, Moon, Sun, User, Settings, LogOut, CreditCard, PiggyBank, Users } from "lucide-react";
import { ProfileModal } from "@/components/profile/profile-modal";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlanBadge } from "@/components/common/plan-badge";

const navSections = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    title: "Money Management",
    items: [
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/budgets", label: "Budgets", icon: Target },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/accounts", label: "Accounts", icon: Wallet },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/goals", label: "Goals", icon: PiggyBank },
      { href: "/debts", label: "Debts", icon: CreditCard },
      { href: "/investments", label: "Investments", icon: TrendingUp },
    ],
  },
];

interface UserData {
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  plan: {
    name: "free" | "basic" | "premium";
  } | null;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

interface NavProps {
  hasSubscription?: boolean;
}

export function Nav({ hasSubscription = true }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Don't render Nav if user doesn't have subscription
  if (!hasSubscription) {
    return null;
  }

  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch("/api/user");
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else {
          // User not authenticated or error - set to null
          setUserData(null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchUserData();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
      });

      if (response.ok) {
        // Redirect to login page
        router.push("/auth/login");
        // Force a page reload to clear any client-side state
        window.location.href = "/auth/login";
      } else {
        console.error("Failed to sign out");
        // Still redirect to login even if there's an error
        router.push("/auth/login");
        window.location.href = "/auth/login";
      }
    } catch (error) {
      console.error("Error signing out:", error);
      // Still redirect to login even if there's an error
      router.push("/auth/login");
      window.location.href = "/auth/login";
    }
  };

  const user = userData?.user;
  const plan = userData?.plan;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-transform hidden md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="text-xl font-bold">
            Spare Finance
          </Link>
        </div>
        
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      if (!hasSubscription) {
                        e.preventDefault();
                        router.push("/select-plan");
                      }
                    }}
                    className={cn(
                      "flex items-center space-x-3 rounded-[12px] px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out",
                      !hasSubscription && "opacity-50 cursor-not-allowed",
                      isActive
                        ? "bg-primary text-primary-foreground translate-x-0"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1 translate-x-0"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t p-4">
          {loading ? (
            <div className="flex items-center space-x-3 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-20 bg-muted rounded-[12px] animate-pulse" />
                <div className="h-2 w-16 bg-muted rounded-[12px] animate-pulse" />
              </div>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-auto p-2"
                >
                  <div className="flex items-center space-x-3 w-full">
                    <div className="relative flex-shrink-0">
                      {user?.avatarUrl ? (
                        <>
                          <img
                            src={user.avatarUrl}
                            alt={user.name || "User"}
                            className="h-8 w-8 rounded-full object-cover border"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const initialsContainer = e.currentTarget.nextElementSibling;
                              if (initialsContainer) {
                                (initialsContainer as HTMLElement).style.display = "flex";
                              }
                            }}
                          />
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-xs font-semibold border">
                            {getInitials(user?.name)}
                          </div>
                        </>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold border">
                          {getInitials(user?.name)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium truncate">
                        {user?.name || "User"}
                      </div>
                      {plan && (
                        <div className="mt-0.5">
                          <PlanBadge plan={plan.name} className="text-[10px] px-1.5 py-0" />
                        </div>
                      )}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setProfileModalOpen(true)}
                  className="cursor-pointer mb-1"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="mb-1">
                  <Link href="/members" className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    <span>Members</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="mb-1">
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="mb-1">
                  <Link href="/billing" className="cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="mb-1">
                  <div className="relative mr-2 h-4 w-4">
                    <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </div>
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <ProfileModal open={profileModalOpen} onOpenChange={setProfileModalOpen} />
    </aside>
  );
}

