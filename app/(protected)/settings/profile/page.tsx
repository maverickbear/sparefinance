"use client";

import { usePagePerformance } from "@/hooks/use-page-performance";
import { useEffect } from "react";
import { ProfileModule } from "./profile-module";
import { HouseholdIncomeSettings } from "@/src/presentation/components/features/onboarding/household-income-settings";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DeleteAccountSection } from "@/components/profile/delete-account-section";

export default function ProfilePage() {
  const perf = usePagePerformance("Settings - Profile");

  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  return (
    <div className="space-y-6">
      <ProfileModule />
      <HouseholdIncomeSettings />
      <ChangePasswordForm />
      <DeleteAccountSection />
    </div>
  );
}

