import { redirect } from "next/navigation";

/**
 * Root Protected Route (/)
 * 
 * This route redirects authenticated users to the dashboard.
 * The landing page at app/page.tsx handles unauthenticated users.
 */
export default function ProtectedRoot() {
  // Redirect to dashboard
  redirect("/dashboard");
}
