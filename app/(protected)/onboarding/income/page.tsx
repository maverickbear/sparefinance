import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { IncomeOnboardingForm } from "@/src/presentation/components/features/onboarding/income-onboarding-form";
import { PageHeader } from "@/components/common/page-header";

export default async function IncomeOnboardingPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/auth/login");
  }

  // Check if income onboarding is already complete
  const service = makeOnboardingService();
  const hasExpectedIncome = await service.checkIncomeOnboardingStatus(userId);

  if (hasExpectedIncome) {
    redirect("/dashboard");
  }

  return (
    <div>
      <PageHeader title="Personalize your financial plan" />
      <div className="w-full p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <IncomeOnboardingForm />
        </div>
      </div>
    </div>
  );
}

