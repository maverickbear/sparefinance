"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Tag,
  FolderTree,
  Mail,
  Star,
  CreditCard,
  Settings2,
  Calculator,
  Search,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tag },
  { href: "/admin/system-entities", label: "System Entities", icon: FolderTree },
  { href: "/admin/contact-forms", label: "Contact Forms", icon: Mail },
  { href: "/admin/feedback", label: "Feedback", icon: Star },
  { href: "/admin/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/subscription-services", label: "Subscription Services", icon: Settings2 },
  { href: "/admin/tax-rates", label: "Tax Rates", icon: Calculator },
  { href: "/admin/seo", label: "SEO Settings", icon: Search },
  { href: "/admin/studio", label: "Sanity Studio", icon: FileCode },
];

export function AdminSideNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col gap-1 border-r bg-muted/30 p-3">
      <Link
        href="/admin"
        className="text-xs font-medium text-muted-foreground px-3 py-2 hover:text-foreground shrink-0"
      >
        Admin
      </Link>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <AdminUserMenu />
    </nav>
  );
}
