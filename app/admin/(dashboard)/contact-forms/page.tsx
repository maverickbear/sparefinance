import { Suspense } from "react";
import { headers } from "next/headers";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { ContactFormsPageClient } from "./contact-forms-client";

async function ContactFormsContent() {
  await headers();
  const adminService = makeAdminService();
  const result = await adminService.getContactForms();
  return <ContactFormsPageClient contactForms={result.contactForms} />;
}

export default function ContactFormsPage() {
  return (
    <Suspense fallback={<div className="w-full p-4 lg:p-8">Loading...</div>}>
      <ContactFormsContent />
    </Suspense>
  );
}
