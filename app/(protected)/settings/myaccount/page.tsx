"use client";

import { usePagePerformance } from "@/hooks/use-page-performance";
import { useEffect } from "react";
import { ProfileModule } from "../profile/profile-module";
import { HouseholdIncomeSettings } from "@/src/presentation/components/features/onboarding/household-income-settings";
import { BudgetPlanSettings } from "@/src/presentation/components/features/onboarding/budget-plan-settings";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DeleteAccountSection } from "@/components/profile/delete-account-section";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PageHeader } from "@/components/common/page-header";

export default function MyAccountPage() {
  const perf = usePagePerformance("Settings - My Account");

  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  return (
    <div>
      <PageHeader
        title="My Account"
      />

      <div className="w-full p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Profile Card */}
        <div>
          <ProfileModule />
        </div>

        {/* Right Column - Other Settings Cards */}
        <div>
          <Accordion type="single" collapsible className="space-y-6">
            <AccordionItem value="income">
              <AccordionTrigger>Expected Household Income & Location</AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="px-6 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Used to tailor your budgets and insights. Location is used to automatically calculate taxes for accurate budget and emergency fund calculations. Not shared with anyone.
                  </p>
                </div>
                <HouseholdIncomeSettings />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="budget">
              <AccordionTrigger>Budget Plan</AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="px-6 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Select a budget rule to automatically allocate your income across different expense categories.
                  </p>
                </div>
                <BudgetPlanSettings />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="password">
              <AccordionTrigger>Change Password</AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="px-6 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Update your password to keep your account secure
                  </p>
                </div>
                <ChangePasswordForm />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="delete">
              <AccordionTrigger>Delete Account</AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="px-6 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <DeleteAccountSection />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
      </div>
    </div>
  );
}
