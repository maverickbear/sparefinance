"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Palette,
  Type,
  Move,
  Image as ImageIcon,
  MousePointer2,
  FileText,
  List,
  Square,
  Menu,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Foundation",
    items: [
      {
        href: "/design/foundation/colors",
        label: "Colors",
        icon: Palette,
      },
      {
        href: "/design/foundation/typography",
        label: "Typography",
        icon: Type,
      },
      {
        href: "/design/foundation/spacing",
        label: "Spacing",
        icon: Move,
      },
      {
        href: "/design/foundation/logos",
        label: "Logos",
        icon: ImageIcon,
      },
    ],
  },
  {
    title: "Components",
    items: [
      {
        href: "/design/components/buttons",
        label: "Buttons",
        icon: MousePointer2,
      },
      {
        href: "/design/components/inputs",
        label: "Inputs",
        icon: Square,
      },
      {
        href: "/design/components/textareas",
        label: "Textareas",
        icon: FileText,
      },
      {
        href: "/design/components/selects",
        label: "Selects",
        icon: List,
      },
      {
        href: "/design/components/feedback",
        label: "Feedback",
        icon: Bell,
      },
    ],
  },
];

interface NavContentProps {
  onLinkClick?: () => void;
}

function NavContent({ onLinkClick }: NavContentProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/design") {
      return pathname === "/design";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Header */}
      <div className="p-4">
        <Link
          href="/design"
          onClick={onLinkClick}
          className="flex items-center gap-2"
        >
          <Logo variant="icon" color="auto" width={32} height={32} />
          <span className="text-lg font-semibold">Design</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

export function DesignSideNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card hidden lg:block">
        <div className="flex h-full flex-col">
          <NavContent />
        </div>
      </aside>

      {/* Mobile Menu */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <Link
            href="/design"
            className="flex items-center gap-2"
          >
            <Logo variant="icon" color="auto" width={32} height={32} />
            <span className="text-lg font-semibold">Design</span>
          </Link>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-full flex-col">
                <NavContent onLinkClick={() => setMobileMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}

