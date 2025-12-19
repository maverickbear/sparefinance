import {
  LayoutDashboard,
  Receipt,
  Target,
  FolderTree,
  TrendingUp,
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
  Palette,
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
 * Portal Management Items (for super admin)
 */
export const portalManagementItems: NavItem[] = [
  { href: "/portal-management/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal-management/users", label: "Users", icon: Users },
  { href: "/portal-management/promo-codes", label: "Promo Codes", icon: Tag },
  { href: "/portal-management/system-entities", label: "System Entities", icon: FolderTree },
  { href: "/portal-management/contact-forms", label: "Contact Forms", icon: Mail },
  { href: "/portal-management/feedback", label: "Feedback", icon: Star },
  { href: "/portal-management/plans", label: "Plans", icon: CreditCard },
  { href: "/portal-management/subscription-services", label: "Subscription Services", icon: Settings2 },
  { href: "/portal-management/tax-rates", label: "Tax Rates", icon: Calculator },
  { href: "/portal-management/seo", label: "SEO Settings", icon: Search },
  { href: "/design", label: "Design System", icon: Palette },
];

/**
 * Base Navigation Sections (without Portal Management)
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
      { href: "#", label: "Investments", icon: TrendingUp, soon: true },
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
 * Get navigation sections for a user
 * @param isSuperAdmin - Whether the user is a super admin
 * @returns Navigation sections array
 */
export function getNavSections(isSuperAdmin: boolean): NavSection[] {
  if (!isSuperAdmin) {
    return baseNavSections;
  }

  return [
    {
      title: "Portal Management",
      items: portalManagementItems,
    },
    ...baseNavSections,
  ];
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
      { id: "investments", label: "Investments", icon: TrendingUp, href: "/investments" },
    ],
  },
];

