import { redirect } from "next/navigation";

/**
 * Redirect /goals to /planning/goals
 * This maintains backward compatibility with old links
 */
export default function GoalsPage() {
  redirect("/planning/goals");
}
