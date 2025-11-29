"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Loader2 } from "lucide-react";

export default function PortalManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  async function checkSuperAdmin() {
    try {
      const response = await fetch("/api/v2/members");
      if (!response.ok) {
        throw new Error("Failed to fetch user role");
      }
      const { userRole: role } = await response.json();
      if (role !== "super_admin") {
        router.push("/dashboard");
        return;
      }
      setIsSuperAdmin(true);
    } catch (error) {
      console.error("Error checking super_admin status:", error);
      router.push("/dashboard");
    }
  }

  if (isSuperAdmin === null) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="w-full">
      <PageHeader title="Portal Management" />
      {children}
    </div>
  );
}

