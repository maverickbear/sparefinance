import { redirect } from "next/navigation";

/**
 * Investments feature was removed.
 * Redirect to dashboard for any existing links.
 */
export default function InvestmentsPage() {
  redirect("/dashboard");
}
