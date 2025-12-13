"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/hooks/use-subscription";
import { Plan, PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { getFeaturePromotion } from "@/lib/utils/feature-promotions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  Wallet, 
  TrendingUp, 
  Download, 
  FileText, 
  HardDrive,
  Infinity,
  Building2,
  CreditCard,
  Eye,
  Target,
  Calendar,
  Clock,
  Users,
  User,
  Home,
  Sparkles,
  Rocket,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  BookOpen
} from "lucide-react";
import { FeaturePromotionWidget } from "./feature-promotion-widgets";

interface BlockedFeatureProps {
  feature?: keyof PlanFeatures;
  featureName?: string;
}

// Icon mapping for feature benefits
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3,
  Wallet,
  TrendingUp,
  Download,
  FileText,
  HardDrive,
  Infinity,
  Building2,
  CreditCard,
  Eye,
  Target,
  Calendar,
  Clock,
  Users,
  User,
  Home,
  Sparkles,
  Rocket,
  MessageCircle,
  CheckCircle2,
  BookOpen,
};

function getFeatureDisplayName(feature?: keyof PlanFeatures, featureName?: string): string {
  if (featureName) return featureName;
  
  if (!feature) return "Feature";
  
  const names: Record<keyof PlanFeatures, string> = {
    maxTransactions: "Unlimited Transactions",
    maxAccounts: "Unlimited Accounts",
    hasInvestments: "Investments",
    hasAdvancedReports: "Advanced Reports",
    hasCsvExport: "CSV Export",
    hasCsvImport: "CSV Import",
    hasDebts: "Debts",
    hasGoals: "Goals",
    hasBankIntegration: "Bank Integration",
    hasHousehold: "Household Members",
    hasBudgets: "Budgets",
    hasReceiptScanner: "Receipt Scanner",
  };

  return names[feature] || "Feature";
}

export function BlockedFeature({ feature, featureName }: BlockedFeatureProps) {
  const router = useRouter();
  const { plan: currentPlan, subscription } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradePlan, setUpgradePlan] = useState<Plan | null>(null);

  const displayName = getFeatureDisplayName(feature, featureName);
  const promotion = getFeaturePromotion(displayName);

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch("/api/billing/plans");
        if (response.ok) {
          const data = await response.json();
          const availablePlans = (data.plans || []) as Plan[];
          setPlans(availablePlans);

          // Find the best upgrade plan (one that has the feature enabled)
          if (feature && currentPlan) {
            const sortedPlans = [...availablePlans].sort(
              (a, b) => a.priceMonthly - b.priceMonthly
            );
            
            for (const plan of sortedPlans) {
              // Check if this plan has the feature enabled
              const hasFeature = plan.features[feature];
              const isUpgrade = plan.priceMonthly > currentPlan.priceMonthly;
              
              if (hasFeature && isUpgrade) {
                setUpgradePlan(plan);
                break;
              }
            }
            
            // If no upgrade found, use the most expensive plan (Pro)
            if (!upgradePlan && sortedPlans.length > 0) {
              setUpgradePlan(sortedPlans[sortedPlans.length - 1]);
            }
          } else if (availablePlans.length > 0) {
            // If no feature specified, default to Pro plan
            setUpgradePlan(availablePlans[availablePlans.length - 1]);
          }
        }
      } catch (error) {
        console.error("Error loading plans:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature, currentPlan]);

  function handleUpgrade() {
    if (upgradePlan) {
      // Check if user has active subscription
      if (subscription?.stripeSubscriptionId) {
        // Redirect to billing settings to change plan
        router.push("/settings/billing");
      } else {
        // Redirect to dashboard - pricing dialog will open automatically
        router.push("/dashboard?openPricingModal=true");
      }
    } else {
      // Redirect to dashboard - pricing dialog will open automatically
      router.push("/dashboard?openPricingModal=true");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] w-full p-4">
        <div className="w-full max-w-6xl space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const price = upgradePlan 
    ? (subscription?.stripeSubscriptionId ? upgradePlan.priceMonthly : upgradePlan.priceMonthly)
    : null;

  return (
    <div className="w-full space-y-8 p-4 sm:p-6 md:p-8 lg:p-10">
      {/* Main Promotion Section - Stripe Style */}
      <div className="bg-white dark:bg-card rounded-lg border border-border p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 xl:gap-16 items-start">
          {/* Left Column - Content */}
          <div className="flex-1 space-y-6 lg:max-w-2xl">
            {/* Headline */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
              {promotion.headline}
            </h1>
            
            {/* Subheadline */}
            <p className="text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl">
              {promotion.subheadline}
            </p>

            {/* Pricing/Trial Info */}
            {!subscription?.stripeSubscriptionId && upgradePlan && price && (
              <div className="space-y-1 pt-2">
                <p className="text-sm md:text-base text-muted-foreground">
                  Free 30-day trial. After this period, you will be charged ${price.toFixed(2)}/month.{" "}
                  <a 
                    href="/terms-of-service" 
                    className="text-foreground hover:underline"
                  >
                    Terms of service
                  </a>
                </p>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
              <Button
                size="medium"
                onClick={handleUpgrade}
                className="w-full sm:w-auto min-w-[220px] text-base"
              >
                {subscription?.stripeSubscriptionId 
                  ? "Upgrade Plan"
                  : "Start 30-day free trial"}
              </Button>
              <Button
                variant="outline"
                size="medium"
                onClick={() => router.push("/dashboard?openPricingModal=true")}
                className="w-full sm:w-auto text-base"
              >
                See pricing details
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-sm md:text-base text-muted-foreground pt-2">
              Need help getting started?{" "}
              <a 
                href="/help-support" 
                className="text-foreground hover:underline font-medium"
              >
                Contact support
              </a>
            </p>
          </div>

          {/* Right Column - Feature Widget */}
          <div className="w-full lg:w-[450px] xl:w-[500px] flex-shrink-0">
            <FeaturePromotionWidget featureName={displayName} />
          </div>
        </div>
      </div>

      {/* Bottom Informational Sections - Stripe Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Info Card */}
        <div className="bg-white dark:bg-card rounded-lg border border-border p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-semibold mb-3 text-foreground">
            Learn more about {displayName}
          </h3>
          <p className="text-sm md:text-base text-muted-foreground mb-4 leading-relaxed">
            {promotion.preview?.description || `Discover how ${displayName} can help you manage your finances more effectively and make better financial decisions.`}
          </p>
          <a 
            href="/help-support" 
            className="text-sm md:text-base text-foreground hover:underline font-medium inline-flex items-center gap-1"
          >
            View documentation
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Right Info Card */}
        <div className="bg-white dark:bg-card rounded-lg border border-border p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-semibold mb-3 text-foreground">
            Make better use of your data
          </h3>
          <p className="text-sm md:text-base text-muted-foreground mb-4 leading-relaxed">
            Get complete and accurate financial insights. Centralize your data and create the reports you need to make informed decisions.
          </p>
          <a 
            href="/reports" 
            className="text-sm md:text-base text-foreground hover:underline font-medium inline-flex items-center gap-1"
          >
            View data schema
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

