"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { SimpleTabs, SimpleTabsList } from "@/components/ui/simple-tabs";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/settings/profile", label: "Profile", value: "profile" },
    { href: "/settings/billing", label: "Billing", value: "billing" },
    { href: "/settings/categories", label: "Categories", value: "categories" },
    { href: "/settings/household", label: "Household", value: "household" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="w-full">
      <PageHeader title="My Account" />

      {/* Fixed Tabs - Desktop only */}
      <FixedTabsWrapper>
        <SimpleTabs value="settings" className="w-full">
          <SimpleTabsList>
            {tabs.map((tab) => (
              <Link
                key={tab.value}
                href={tab.href}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "text-content-tertiary -mb-[1px]",
                  isActive(tab.href)
                    ? "text-content-primary border-b-2 border-primary"
                    : "hover:text-content-primary hover:border-b-2 hover:border-primary"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </SimpleTabsList>
        </SimpleTabs>
      </FixedTabsWrapper>

      {/* Mobile/Tablet Tabs - Sticky at top */}
      <div className="lg:hidden sticky top-0 z-40 bg-card dark:bg-transparent border-b">
        <div
          className="overflow-x-auto scrollbar-hide"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "x mandatory",
            touchAction: "pan-x",
          }}
        >
          <SimpleTabs value="settings" className="w-full">
            <SimpleTabsList
              className="min-w-max px-4"
              style={{ scrollSnapAlign: "start" }}
            >
              {tabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-shrink-0",
                    "text-content-tertiary -mb-[1px]",
                    isActive(tab.href)
                      ? "text-content-primary border-b-2 border-primary"
                      : "hover:text-content-primary hover:border-b-2 hover:border-primary"
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </SimpleTabsList>
          </SimpleTabs>
        </div>
      </div>

      <div className="w-full p-4 lg:p-8 space-y-6">{children}</div>
    </div>
  );
}

