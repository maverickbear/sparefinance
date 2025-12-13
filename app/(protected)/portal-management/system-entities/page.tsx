import { Suspense } from "react";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { redirect } from "next/navigation";
import { SystemEntitiesPageClient } from "./system-entities-client";
import type { SystemCategory, SystemSubcategory } from "@/src/domain/admin/admin.types";

async function SystemEntitiesContent() {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    redirect("/auth/login");
  }

  const adminService = makeAdminService();
  
  // Check if user is super_admin
  if (!(await adminService.isSuperAdmin(userId))) {
    redirect("/dashboard");
  }

  // Fetch all system entities in parallel
  // NOTE: Groups have been removed, so we pass an empty array
  const [categories, subcategories] = await Promise.all([
    adminService.getAllSystemCategories(),
    adminService.getAllSystemSubcategories(),
  ]);

  // Serialize Date objects to ISO strings for client component
  // Next.js cannot serialize Date objects when passing from server to client components
  const serializedCategories = categories.map(cat => ({
    ...cat,
    createdAt: typeof cat.createdAt === 'string' ? cat.createdAt : cat.createdAt.toISOString(),
    updatedAt: typeof cat.updatedAt === 'string' ? cat.updatedAt : cat.updatedAt.toISOString(),
    subcategories: cat.subcategories?.map(sub => ({
      ...sub,
      createdAt: typeof sub.createdAt === 'string' ? sub.createdAt : sub.createdAt.toISOString(),
      updatedAt: typeof sub.updatedAt === 'string' ? sub.updatedAt : sub.updatedAt.toISOString(),
    })),
  }));

  const serializedSubcategories = subcategories.map(sub => ({
    ...sub,
    createdAt: typeof sub.createdAt === 'string' ? sub.createdAt : sub.createdAt.toISOString(),
    updatedAt: typeof sub.updatedAt === 'string' ? sub.updatedAt : sub.updatedAt.toISOString(),
  }));

  return (
    <SystemEntitiesPageClient
      initialGroups={[]}
      initialCategories={serializedCategories}
      initialSubcategories={serializedSubcategories}
    />
  );
}

export default function SystemEntitiesPage() {
  return (
    <Suspense fallback={<div className="w-full p-4 lg:p-8">Loading...</div>}>
      <SystemEntitiesContent />
    </Suspense>
  );
}

