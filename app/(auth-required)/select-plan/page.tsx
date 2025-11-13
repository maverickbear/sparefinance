import { redirect } from "next/navigation";

/**
 * This page has been replaced by the pricing modal.
 * All users are now redirected to dashboard where the modal will open if needed.
 */
export default function SelectPlanPage() {
  redirect("/dashboard");
}

