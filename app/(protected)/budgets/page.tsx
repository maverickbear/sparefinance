import { redirect } from "next/navigation";

/**
 * Redirect /budgets to /planning/budgets
 * This maintains backward compatibility with old links
 */
export default function BudgetsPage() {
  redirect("/planning/budgets");
}
