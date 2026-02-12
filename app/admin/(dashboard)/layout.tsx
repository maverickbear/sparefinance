import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AdminSideNav } from "@/components/admin/admin-side-nav";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/admin/login");
  }

  const adminService = makeAdminService();
  const canAccessPortal = await adminService.isSuperAdmin(userId);

  if (!canAccessPortal) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSideNav />
      <div className="ml-56 flex flex-1 flex-col min-w-0">
        <div className="border-b px-4 py-2 flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="small">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to home
            </Button>
          </Link>
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
