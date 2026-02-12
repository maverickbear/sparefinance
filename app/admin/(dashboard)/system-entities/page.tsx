import { Suspense } from "react";
import { headers } from "next/headers";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { SystemEntitiesPageClient } from "./system-entities-client";

async function SystemEntitiesContent() {
  await headers();
  const adminService = makeAdminService();
  const [categories, subcategories] = await Promise.all([
    adminService.getAllSystemCategories(),
    adminService.getAllSystemSubcategories(),
  ]);

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
