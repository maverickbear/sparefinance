import {
  LayoutDashboard,
  Receipt,
  Target,
  FolderTree,
  FileText,
  CreditCard,
  PiggyBank,
  Users,
  Wallet,
  Calendar,
  Repeat,
  User,
  Settings2,
  Tag,
  Mail,
  Star,
  Search,
  Calculator,
  DollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Navigation Item Definition
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isToggle?: boolean;
  isBack?: boolean;
  soon?: boolean;
}

/**
 * Navigation Section Definition
 */
export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Base Navigation Sections (consumer app only; admin has its own menu)
 */
export const baseNavSections: NavSection[] = [
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
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/planning/budgets", label: "Budgets", icon: Target },
      { href: "/planning/goals", label: "Goals", icon: PiggyBank },
      { href: "/debts", label: "Debts", icon: CreditCard },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings/myaccount", label: "My Account", icon: User },
      { href: "/settings/billing", label: "Billing", icon: DollarSign },
      { href: "/settings/household", label: "Household", icon: Users },
      { href: "/settings/categories", label: "Categories", icon: FolderTree },
    ],
  },
];

/**
 * Get navigation sections for the consumer app (admin portal has its own menu).
 */
export function getNavSections(): NavSection[] {
  return baseNavSections;
}

/**
 * Bottom Navigation Items (Mobile)
 */
export interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  type: "link" | "button";
  onClick?: () => void;
}

/**
 * KBar Command Definition
 */
export interface KBarCommand {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface KBarCommandGroup {
  title: string;
  commands: KBarCommand[];
}

/**
 * KBar Command Groups
 */
export const kbarCommandGroups: KBarCommandGroup[] = [
  {
    title: "Overview",
    commands: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { id: "reports", label: "Reports", icon: FileText, href: "/reports" },
    ],
  },
  {
    title: "Money Management",
    commands: [
      { id: "accounts", label: "Bank Accounts", icon: Wallet, href: "/accounts" },
      { id: "transactions", label: "Transactions", icon: Receipt, href: "/transactions" },
      { id: "subscriptions", label: "Subscriptions", icon: Repeat, href: "/subscriptions" },
      { id: "planned-payment", label: "Planned Payments", icon: Calendar, href: "/planned-payment" },
      { id: "categories", label: "Categories", icon: FolderTree, href: "/settings/categories" },
      { id: "household", label: "Household", icon: Users, href: "/settings/household" },
    ],
  },
  {
    title: "Planning",
    commands: [
      { id: "budgets", label: "Budgets", icon: Target, href: "/planning/budgets" },
      { id: "goals", label: "Goals", icon: PiggyBank, href: "/planning/goals" },
      { id: "debts", label: "Debts", icon: CreditCard, href: "/debts" },
    ],
  },
];

