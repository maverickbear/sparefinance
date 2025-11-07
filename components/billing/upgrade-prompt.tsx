"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, TrendingUp, BarChart3, FileText, Download, Users, Wallet, Target, Check } from "lucide-react";
import Link from "next/link";
import { getFeaturePromotion } from "@/lib/utils/feature-promotions";

function FeaturePreview({ feature, planName }: { feature: string; planName: string }) {
  if (feature === "Investments") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Portfolio Overview</span>
          <span className="text-xs text-primary/80">{planName}</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-muted-foreground/60 mb-1.5">Total Value</div>
            <div className="text-2xl font-semibold tracking-tight">$45,230</div>
            <div className="text-xs text-green-600 dark:text-green-500 mt-1.5">+12.5%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground/60 mb-1.5">This Month</div>
            <div className="text-xl font-medium">$1,500</div>
            <div className="text-xs text-muted-foreground/60 mt-1.5">3 accounts</div>
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground/70">401(k) Retirement</span>
            <span className="font-medium">$28,450</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground/70">Brokerage Account</span>
            <span className="font-medium">$12,780</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground/70">Crypto Portfolio</span>
            <span className="font-medium">$4,000</span>
          </div>
        </div>
      </div>
    );
  }

  if (feature === "Advanced Reports") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Report Types</span>
          <span className="text-xs text-primary/80">{planName}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <BarChart3 className="w-5 h-5 mx-auto mb-2 text-primary/80" />
            <div className="text-xs font-medium">Spending</div>
          </div>
          <div className="text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary/80" />
            <div className="text-xs font-medium">Income</div>
          </div>
          <div className="text-center">
            <Target className="w-5 h-5 mx-auto mb-2 text-primary/80" />
            <div className="text-xs font-medium">Budget</div>
          </div>
        </div>
        <div className="pt-4 border-t border-border/50">
          <div className="text-xs text-muted-foreground/60 mb-3">Monthly Comparison</div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground/70">This Month</span>
              <span className="font-medium">$3,246</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground/70">Last Month</span>
              <span className="text-muted-foreground/60">$2,890</span>
            </div>
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Change</span>
                <span className="text-red-600 dark:text-red-500">+12.3%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (feature === "CSV Export") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Export Options</span>
          <span className="text-xs text-primary/80">{planName}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-muted-foreground/70">All Transactions</span>
            <FileText className="w-4 h-4 text-primary/60" />
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-muted-foreground/70">Accounts Summary</span>
            <FileText className="w-4 h-4 text-primary/60" />
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-muted-foreground/70">Budget Data</span>
            <FileText className="w-4 h-4 text-primary/60" />
          </div>
        </div>
      </div>
    );
  }

  if (feature === "Household Members") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Family Overview</span>
          <span className="text-xs text-primary/80">{planName}</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Users className="w-5 h-5 mb-2 text-primary/80" />
            <div className="text-sm font-medium">3 Members</div>
            <div className="text-xs text-muted-foreground/60">Active</div>
          </div>
          <div>
            <Wallet className="w-5 h-5 mb-2 text-primary/80" />
            <div className="text-sm font-medium">12 Accounts</div>
            <div className="text-xs text-muted-foreground/60">Total</div>
          </div>
        </div>
        <div className="space-y-2.5 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2.5 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
            <span>You (Admin)</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground/70">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></div>
            <span>Spouse</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground/70">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></div>
            <span>Child</span>
          </div>
        </div>
      </div>
    );
  }

  // Default preview
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Preview</span>
        <span className="text-xs text-primary/80">{planName}</span>
      </div>
      <div className="text-sm text-muted-foreground/60 text-center py-4">
        Unlock {feature} to see this feature in action
      </div>
    </div>
  );
}

interface UpgradePromptProps {
  feature: string;
  currentPlan?: string;
  requiredPlan?: "basic" | "premium";
  message?: string;
  className?: string;
}

export function UpgradePrompt({
  feature,
  currentPlan = "free",
  requiredPlan = "basic",
  message,
  className = "",
}: UpgradePromptProps) {
  const planName = requiredPlan === "premium" ? "Premium" : "Basic";
  const promotion = getFeaturePromotion(feature);

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <div className="space-y-12 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/5 text-primary text-xs font-medium border border-primary/10">
            <Lock className="w-3 h-3" />
            {feature}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            {promotion.headline}
          </h2>
          <p className="text-base text-muted-foreground/80 max-w-xl mx-auto leading-relaxed">
            {promotion.subheadline}
          </p>
        </div>

        {/* Feature Preview */}
        {promotion.preview && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 rounded-2xl blur-3xl"></div>
            <div className="relative p-8 bg-background/50 backdrop-blur-sm rounded-2xl border border-border/50">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">{promotion.preview.title}</h3>
                  <p className="text-sm text-muted-foreground/70">{promotion.preview.description}</p>
                </div>
              </div>
              <div className="p-6 bg-background/80 rounded-xl border border-border/30">
                <FeaturePreview feature={feature} planName={planName} />
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        <div className="grid gap-6 md:grid-cols-3">
          {promotion.benefits.map((benefit, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">{benefit.icon}</span>
                <div className="flex-1 space-y-1">
                  <h3 className="font-medium text-sm text-foreground">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center space-y-6 pt-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Ready to unlock {feature}?</h3>
            <p className="text-sm text-muted-foreground/70">
              Start your free trial. No credit card required.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/pricing?upgrade=${requiredPlan}`}>
                Upgrade to {planName}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <Link href="/pricing">
                See pricing
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60">
            By continuing, you agree to our{" "}
            <Link href="/terms-of-use" className="underline hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

