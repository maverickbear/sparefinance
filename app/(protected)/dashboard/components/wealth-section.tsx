"use client";

import { useMemo } from "react";
import { formatMoney } from "@/components/common/money";
import { SimplifiedCard } from "./simplified-card";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";

interface WealthSectionProps {
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  accounts: AccountWithBalance[];
}

export function WealthSection({
  netWorth,
  totalAssets,
  totalDebts,
  accounts,
}: WealthSectionProps) {
  // Calculate investments (sum of investment accounts)
  const investments = useMemo(() => {
    return accounts
      .filter((acc) => acc.type === "investment")
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  return (
    <section
      className="rounded-[var(--radius)] p-0 mt-3.5"
      aria-label="Wealth"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="m-0 text-2xl font-semibold text-foreground">
          My financial foundation
        </h2>
        <div className="text-muted-foreground text-xs">High-level only</div>
      </div>

      <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2">
        <SimplifiedCard
          label="Net worth"
          value={formatMoney(netWorth)}
          subtitle="Assets minus debts."
          pill={{ text: "Total" }}
        />

        <SimplifiedCard
          label="Investments"
          value={formatMoney(investments)}
          subtitle="Click to view portfolio details."
          pill={{ text: "Total" }}
        />
      </div>
    </section>
  );
}

