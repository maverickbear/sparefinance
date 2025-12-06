"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Receipt, 
  FileText, 
  FolderTree, 
  Wallet, 
  Users, 
  PiggyBank, 
  CreditCard, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight, 
  User,
  ChevronDown,
  Target,
  Calendar,
  Repeat,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/common/logo";
import { PageHeader } from "@/components/common/page-header";
import { DashboardDemoStatic } from "./dashboard-demo-static";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const navSections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    title: "Money Management",
    items: [
      { href: "/accounts", label: "Bank Accounts", icon: Wallet },
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/planned-payment", label: "Planned Payments", icon: Calendar },
      { href: "/settings/categories", label: "Categories", icon: FolderTree },
      { href: "/members", label: "Household", icon: Users },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/planning/budgets", label: "Budgets", icon: Target },
      { href: "/planning/goals", label: "Goals", icon: PiggyBank },
      { href: "/debts", label: "Debts", icon: CreditCard },
      { href: "/investments", label: "Investments", icon: TrendingUp },
    ],
  },
];

export function DashboardDemo() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  // Set date after component mounts to avoid SSR/prerendering issues
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  return (
    <>
      {/* Desktop Version */}
      <div className="hidden md:flex h-[700px] bg-background overflow-hidden pointer-events-none min-w-0">
        {/* Side Menu */}
        <TooltipProvider>
          <aside
            className={cn(
              "border-r bg-card transition-all duration-300 flex-shrink-0",
              isCollapsed ? "w-16" : "w-64"
            )}
          >
            <div className="flex h-full flex-col">
            <div
              className={cn(
                "flex h-16 min-h-[64px] items-center border-b px-4 relative justify-center"
              )}
            >
              {isCollapsed ? (
                <Logo variant="icon" color="auto" width={40} height={40} />
              ) : (
                <Logo variant="wordmark" color="auto" width={200} height={53} />
              )}
            </div>

              <nav className={cn(
                "flex-1 space-y-5 px-3 py-4 overflow-hidden",
                isCollapsed && "overflow-visible"
              )}>
                {navSections.map((section) => {
                  const isSectionCollapsed = collapsedSections.has(section.title);
                  return (
                  <div key={section.title} className="space-y-1">
                    {!isCollapsed && (
                      <button
                        onClick={() => {
                          setCollapsedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(section.title)) {
                              next.delete(section.title);
                            } else {
                              next.add(section.title);
                            }
                            return next;
                          });
                        }}
                        className="flex items-center justify-between w-full px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        <span>{section.title}</span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            isSectionCollapsed && "rotate-[-90deg]"
                          )}
                        />
                      </button>
                    )}
                    <div className={cn(
                      "transition-all duration-200 ease-in-out",
                      isSectionCollapsed ? "max-h-0 overflow-hidden opacity-0" : "max-h-[500px] opacity-100"
                    )}>
                      {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.href === "/dashboard";
                      const linkElement = (
                        <div
                          className={cn(
                            "flex items-center rounded-lg text-sm font-medium transition-all duration-200 ease-in-out cursor-pointer",
                            isActive
                              ? "bg-primary text-primary-foreground translate-x-0"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1 translate-x-0",
                            isCollapsed
                              ? "justify-center px-3 py-2"
                              : "space-x-3 px-3 py-2"
                          )}
                          style={{ pointerEvents: "none" }}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </div>
                      );

                      if (isCollapsed) {
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <div className="relative">
                                {linkElement}
                                <TooltipContent side="right">
                                  {item.label}
                                </TooltipContent>
                              </div>
                            </TooltipTrigger>
                          </Tooltip>
                        );
                      }

                      return <div key={item.href}>{linkElement}</div>;
                    })}
                    </div>
                  </div>
                );
                })}
              </nav>

              <div className="p-3">
                <div
                  className={cn(
                    "flex items-center w-full border border-border shadow rounded-lg",
                    isCollapsed ? "justify-center p-2" : "space-x-3 px-3 py-2"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold border flex-shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium truncate">
                        John Doe
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        demo@sparefinance.com
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
          {/* Toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "absolute top-4 h-5 w-5 z-50 bg-card border border-border shadow-sm flex items-center justify-center transition-opacity duration-200",
                  isCollapsed ? "left-16" : "left-64"
                )}
                style={{ transform: 'translateX(-50%)', pointerEvents: 'none' }}
                onClick={() => {}}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronLeft className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? "right" : "bottom"}>
              {isCollapsed ? "Expand menu" : "Collapse menu"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Page Header */}
          <PageHeader title="Welcome, John Doe">
            <div style={{ pointerEvents: "none" }}>
              <Select value="current" disabled>
                <SelectTrigger size="small" className="w-[180px]">
                  <SelectValue>
                    {currentDate ? format(currentDate, "MMMM yyyy") : "Loading..."}
                  </SelectValue>
                </SelectTrigger>
              </Select>
            </div>
          </PageHeader>

          {/* Dashboard Content */}
          <div className="w-full p-4 lg:p-8">
            <DashboardDemoStatic />
          </div>
        </div>
      </div>

      {/* Mobile Version */}
      <div className="md:hidden h-[600px] bg-background overflow-hidden pointer-events-none flex flex-col">
        {/* Mobile Header */}
        <div className="flex-shrink-0 border-b bg-card px-4 py-3">
          <div className="flex items-center gap-3 min-h-[44px] flex-1">
            <Logo variant="icon" color="auto" width={32} height={32} />
            <h1 className="text-base font-semibold">Welcome, John Doe</h1>
          </div>
        </div>

        {/* Mobile Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          <DashboardDemoStatic />
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
          <div className="flex h-16 items-center justify-around">
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium text-primary">
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium text-muted-foreground">
              <Receipt className="h-5 w-5" />
              <span>Transactions</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium text-muted-foreground">
              <FileText className="h-5 w-5" />
              <span>Reports</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
