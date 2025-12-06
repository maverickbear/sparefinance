import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

/**
 * This page has been replaced by the pricing modal.
 * All users are now redirected to dashboard where the modal will open if needed.
 */
export const dynamic = 'force-dynamic';

export default function SelectPlanPage() {
  // Opt out of static generation - this page redirects and requires auth
  noStore();
  redirect("/dashboard");
}

