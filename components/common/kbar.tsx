"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Receipt,
  Target,
  FolderTree,
  Wallet,
  TrendingUp,
  FileText,
  PiggyBank,
  CreditCard,
  Users,
  Repeat,
  Calendar,
} from "lucide-react";

interface KBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const commandGroups = [
  {
    title: "Overview",
    commands: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
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
      { id: "categories", label: "Categories", icon: FolderTree, href: "/categories" },
      { id: "household", label: "Household", icon: Users, href: "/members" },
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

export function KBar({ open, onOpenChange }: KBarProps) {
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="rounded-[12px] border">
          <Command.Input
            placeholder="Search commands..."
            className="w-full px-4 py-3 text-sm border-b outline-none"
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty>No results found.</Command.Empty>
            {commandGroups.map((group) => (
              <Command.Group key={group.title} heading={group.title}>
                {group.commands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => handleSelect(cmd.href)}
                      className="flex items-center space-x-2 px-2 py-2 rounded-[12px] cursor-pointer hover:bg-accent"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{cmd.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

