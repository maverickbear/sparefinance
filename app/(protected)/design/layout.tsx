import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeMembersService } from "@/src/application/members/members.factory";

export default async function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    redirect("/auth/login");
  }

  // Check if user is super_admin
  const membersService = makeMembersService();
  const userRole = await membersService.getUserRole(userId);
  
  if (userRole !== "super_admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

