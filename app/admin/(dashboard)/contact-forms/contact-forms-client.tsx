"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactFormsTable, ContactForm } from "@/components/admin/contact-forms-table";

interface ContactFormsPageClientProps {
  contactForms: ContactForm[];
}

export function ContactFormsPageClient({ contactForms }: ContactFormsPageClientProps) {
  const router = useRouter();

  function handleUpdate() {
    router.refresh();
  }

  return (
    <div className="w-full p-4 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Contact Forms</CardTitle>
          <CardDescription>
            View and manage contact form submissions from users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactFormsTable
            contactForms={contactForms}
            loading={false}
            onUpdate={handleUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
