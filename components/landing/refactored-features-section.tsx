"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  Target, 
  PiggyBank, 
  CreditCard, 
  BarChart3,
  Users,
  FileText,
  Repeat,
  Calendar,
  Download,
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { DashboardWidgetsDemo } from "./demo/dashboard-widgets-demo";
import { BankAccountsDemo } from "./demo/bank-accounts-demo";
import { BudgetsDemo } from "./demo/budgets-demo";
import { InvestmentsDemo } from "./demo/investments-demo";
import { DebtsDemo } from "./demo/debts-demo";
import { GoalsDemo } from "./demo/goals-demo";
import { CategorizationDemo } from "./demo/categorization-demo";
import { cn } from "@/lib/utils";

// ============================================================================
// CORE FEATURES - Maximum visual impact and conversion focus
// ============================================================================

interface CoreFeatureProps {
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  demoComponent: React.ReactNode;
  layout: "split-left" | "split-right" | "hero" | "fullscreen";
  badge?: string;
  icon?: React.ReactNode;
}

function CoreFeatureSplit({ 
  title, 
  subtitle, 
  description, 
  benefits, 
  demoComponent, 
  reverse = false,
  badge 
}: Omit<CoreFeatureProps, "layout"> & { reverse?: boolean }) {
  return (
    <section className={cn(
      "py-20 md:py-28",
      reverse ? "bg-muted/30" : "bg-background"
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          "flex flex-col gap-12 lg:gap-20",
          reverse ? "lg:flex-row-reverse" : "lg:flex-row"
        )}>
          {/* Content */}
          <div className="w-full lg:w-1/2 flex items-center">
            <div className="w-full">
              {badge && (
                <Badge variant="outline" size="medium" className="mb-5 text-xs font-medium tracking-wide">
                  {badge}
                </Badge>
              )}
              <p className="text-xs font-medium text-primary/80 mb-3 tracking-wider uppercase">
                {subtitle}
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold mb-5 tracking-tight leading-[1.1]">
                {title}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground font-light leading-relaxed mb-7">
                {description}
              </p>
              <ul className="space-y-3.5">
                {benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary/90 mt-0.5 flex-shrink-0" />
                    <span className="text-base text-foreground/90 leading-relaxed">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Demo */}
          <div className="w-full lg:w-1/2">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-border/40 shadow-sm">
              <div className="aspect-video w-full flex items-center justify-center p-5 lg:p-7 min-h-[380px] lg:min-h-[560px]">
                <div className="w-full h-full flex items-center justify-center scale-100 lg:scale-105">
                  {demoComponent}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreFeatureHero({ 
  title, 
  subtitle, 
  description, 
  benefits, 
  demoComponent,
  badge,
  icon 
}: Omit<CoreFeatureProps, "layout">) {
  return (
    <section className="py-28 md:py-36 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center mb-14">
          {badge && (
            <Badge variant="outline" size="large" className="mb-5 text-xs font-medium tracking-wide">
              {badge}
            </Badge>
          )}
          <p className="text-xs font-medium text-primary/80 mb-3 tracking-wider uppercase">
            {subtitle}
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 tracking-tight leading-[1.1]">
            {title}
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground font-light leading-relaxed mb-10 max-w-3xl mx-auto">
            {description}
          </p>
          <div className="grid md:grid-cols-2 gap-5 text-left max-w-2xl mx-auto">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary/90 mt-0.5 flex-shrink-0" />
                <span className="text-base text-foreground/90 leading-relaxed">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-border/40 shadow-sm max-w-6xl mx-auto">
          <div className="aspect-video w-full flex items-center justify-center p-6 lg:p-10 min-h-[480px] lg:min-h-[640px]">
            <div className="w-full h-full flex items-center justify-center scale-100 lg:scale-105">
              {demoComponent}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreFeatureFullscreen({ 
  title, 
  subtitle, 
  description, 
  benefits, 
  icon 
}: Omit<CoreFeatureProps, "layout" | "demoComponent">) {
  return (
    <section className="py-32 md:py-40 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            {icon && (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/8 border border-primary/10 mb-6">
                <div className="text-primary/90">{icon}</div>
              </div>
            )}
            <p className="text-sm font-semibold text-primary mb-4 tracking-wide uppercase">
              {subtitle}
            </p>
            <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold mb-8 tracking-tight leading-tight">
              {title}
            </h2>
            <p className="text-xl sm:text-2xl text-muted-foreground font-light leading-relaxed mb-12 max-w-3xl mx-auto">
              {description}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, idx) => (
              <Card key={idx} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">{benefit}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// ADVANCED FEATURES - Important but secondary
// ============================================================================

interface AdvancedFeatureProps {
  title: string;
  description: string;
  benefits: string[];
  demoComponent?: React.ReactNode;
  icon: React.ReactNode;
}

function AdvancedFeatureCard({ 
  title, 
  description, 
  benefits, 
  demoComponent,
  icon 
}: AdvancedFeatureProps) {
  return (
    <Card className="h-full border hover:border-primary/40 transition-all duration-300 hover:shadow-md bg-card/50">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2.5 rounded-lg bg-primary/8 border border-primary/10">
            <div className="text-primary/90">{icon}</div>
          </div>
          <CardTitle className="text-xl font-semibold leading-tight pt-0.5">{title}</CardTitle>
        </div>
        <CardDescription className="text-base leading-relaxed text-muted-foreground/90">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {demoComponent && (
          <div className="mb-5 rounded-lg overflow-hidden bg-muted/30 border border-border/40 p-3">
            {demoComponent}
          </div>
        )}
        <ul className="space-y-2.5">
          {benefits.map((benefit, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary/80 mt-0.5 flex-shrink-0" />
              <span className="text-base text-muted-foreground/90 leading-relaxed">{benefit}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ASSISTIVE FEATURES - Support features, compact cards
// ============================================================================

interface AssistiveFeatureProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

function AssistiveFeatureCard({ title, description, icon }: AssistiveFeatureProps) {
  return (
    <Card className="h-full border hover:border-primary/30 transition-all duration-300 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-md bg-primary/8 border border-primary/10">
            <div className="text-primary/80">{icon}</div>
          </div>
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base leading-relaxed text-muted-foreground/85">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RefactoredFeaturesSection() {
  return (
    <section id="features" className="bg-background">
      {/* Section Header */}
      <div className="pt-20 md:pt-28 pb-14 md:pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="outline" size="large" className="mb-5 text-xs font-medium tracking-wide">
              Everything You Need
            </Badge>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold mb-5 tracking-tight leading-[1.1]">
              Stop Managing Money.<br />Start Mastering It.
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground font-light leading-relaxed">
              Powerful features designed to help you take control of your finances and save time and money.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================================
          CORE FEATURES - Maximum Impact
          ====================================================================== */}
      
      {/* Feature 1: Dashboard - Split Right */}
      <CoreFeatureSplit
        title="Your Complete Financial Command Center"
        subtitle="Unified Dashboard"
        description="See everything that matters in one beautiful, intuitive dashboard. Instead of juggling multiple apps and spreadsheets, you get a unified source of truth for your entire financial life—income, expenses, budgets, goals, and investments, all in real-time."
        benefits={[
          "Real-time overview of income, expenses, and net worth",
          "Interactive charts and visualizations that make data simple",
          "Spare Score: AI-powered financial health insights",
          "Customizable widgets to focus on what matters to you",
          "Historical data navigation to track your progress over time"
        ]}
        demoComponent={<DashboardWidgetsDemo />}
        reverse={false}
        badge="Core Feature"
      />

      {/* Feature 2: AI Categorization - Split Left */}
      <CoreFeatureSplit
        title="AI That Learns Your Spending Patterns"
        subtitle="Smart Categorization"
        description="Our intelligent system learns from your spending history and automatically suggests categories for every transaction. The more you use it, the better it gets at recognizing your patterns. Just approve or adjust—no more tedious manual categorization."
        benefits={[
          "Automatic category suggestions based on your transaction history",
          "Learns your patterns and improves suggestions over time",
          "One-click approval or quick adjustments when needed",
          "Handles recurring transactions and similar patterns",
          "Saves hours of manual work every month"
        ]}
        demoComponent={<CategorizationDemo />}
        reverse={true}
        badge="AI-Powered"
      />

      {/* Feature 3: Budget Management - Split Right */}
      <CoreFeatureSplit
        title="Budgets That Actually Work"
        subtitle="Smart Budget Management"
        description="Set budgets by category and watch your progress in real-time. Get visual alerts when you're approaching limits, and let our system help you stay on track effortlessly. No more surprise overspending—just clear, actionable insights."
        benefits={[
          "Set flexible budgets by category (monthly, quarterly, or annual)",
          "Real-time progress tracking with beautiful visual indicators",
          "Smart alerts when approaching or exceeding limits",
          "Historical budget analysis to improve your planning",
          "Automatic categorization makes budget tracking effortless"
        ]}
        demoComponent={<BudgetsDemo />}
        reverse={false}
        badge="Essential"
      />

      {/* Feature 4: Bank Sync - Hero Layout (Coming Soon with Plaid) */}
      <CoreFeatureHero
        title="Connect Your Banks in Seconds"
        subtitle="Automatic Bank Sync"
        description="Instead of manually entering every transaction, connect your bank accounts once and watch your finances update automatically. Your data stays synchronized 24/7, so you always know exactly where you stand—no spreadsheets, no manual work, no guesswork."
        benefits={[
          "Connect multiple banks and accounts in under 60 seconds",
          "Transactions import automatically—no manual entry ever again",
          "Secure connection via Plaid with 256-bit encryption and read-only access",
          "Real-time balance updates across all your accounts",
          "Works with 11,000+ financial institutions worldwide"
        ]}
        demoComponent={<BankAccountsDemo />}
        badge="Coming Soon"
        icon={<Zap className="w-6 h-6" />}
      />

      {/* ======================================================================
          ADVANCED FEATURES - Grid Layout
          ====================================================================== */}
      
      <section className="py-20 md:py-28 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-3 tracking-tight leading-[1.1]">
              Advanced Tools for Serious Planning
            </h3>
            <p className="text-base sm:text-lg text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
              Take your financial planning to the next level with powerful features designed for long-term success.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AdvancedFeatureCard
              title="Investment Portfolio Tracking"
              description="Track stocks, ETFs, and more. Monitor your portfolio value, calculate returns, and see how your investments are performing—all integrated with your overall financial picture."
              benefits={[
                "Portfolio value tracking and calculations",
                "Performance calculations and return analysis",
                "Questrade integration for Canadian investors",
                "Investment account and holdings management"
              ]}
              demoComponent={<InvestmentsDemo />}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            
            <AdvancedFeatureCard
              title="Smart Debt Management"
              description="Track and manage all your debts in one place. Monitor interest rates, payment schedules, and progress. Get insights on how to pay off debts faster and save on interest."
              benefits={[
                "Track mortgages, loans, and credit cards",
                "Interest tracking and savings calculations",
                "Payment schedule and progress monitoring",
                "Automatic balance and payoff calculations"
              ]}
              demoComponent={<DebtsDemo />}
              icon={<CreditCard className="w-5 h-5" />}
            />
            
            <AdvancedFeatureCard
              title="Savings Goals That Actually Work"
              description="Set multiple savings goals and allocate a percentage of your income to each. Watch your progress with beautiful visualizations and get accurate estimates of when you'll reach your goals."
              benefits={[
                "Multiple simultaneous goals with priority levels",
                "Automatic income percentage allocation",
                "Progress tracking with ETA calculations",
                "Visual progress indicators and milestones"
              ]}
              demoComponent={<GoalsDemo />}
              icon={<PiggyBank className="w-5 h-5" />}
            />
            
            <AdvancedFeatureCard
              title="Comprehensive Reports & Analytics"
              description="Generate detailed financial reports with beautiful charts and insights. Understand your spending patterns, income trends, and financial health over time."
              benefits={[
                "Customizable date ranges and filters",
                "Export transaction data to CSV",
                "Spending pattern analysis",
                "Income vs. expenses trends"
              ]}
              icon={<BarChart3 className="w-5 h-5" />}
            />
            
            <AdvancedFeatureCard
              title="Household & Multi-User Support"
              description="Manage finances for your entire household. Invite family members, share accounts, and get a unified view of your collective financial health."
              benefits={[
                "Invite family members to your household",
                "Shared account visibility and management",
                "Unified financial overview",
                "Role-based permissions and access control"
              ]}
              icon={<Users className="w-5 h-5" />}
            />
            
            <AdvancedFeatureCard
              title="Planned Payments & Recurring Transactions"
              description="Never miss a payment again. Set up recurring transactions and planned payments to stay ahead of your bills and subscriptions."
              benefits={[
                "Automatic recurring transaction detection",
                "Planned payment scheduling",
                "Upcoming payment alerts",
                "Subscription tracking and management"
              ]}
              icon={<Calendar className="w-5 h-5" />}
            />
          </div>
        </div>
      </section>

      {/* ======================================================================
          ASSISTIVE FEATURES - Compact Grid
          ====================================================================== */}
      
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 tracking-tight leading-[1.1]">
              Everything Else You Need
            </h3>
            <p className="text-base text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
              Additional features that make your financial management seamless and secure.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            <AssistiveFeatureCard
              title="Enterprise-Grade Security"
              description="256-bit encryption for sensitive data, read-only bank access via Plaid, and encrypted data storage. Your financial information is protected with industry-standard security measures."
              icon={<Shield className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="CSV Import & Export"
              description="Import transactions from spreadsheets or export your data anytime. Full control over your financial information."
              icon={<Download className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="Recurring Transactions"
              description="Automatically detect and categorize recurring bills, subscriptions, and income. Set it once and forget it."
              icon={<Repeat className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="Planned Payments"
              description="Schedule future payments and see upcoming expenses. Plan ahead and never be caught off guard."
              icon={<Calendar className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="Subscription Tracking"
              description="Track all your subscriptions in one place. See what you're paying for and identify opportunities to save."
              icon={<Repeat className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="Transaction Search"
              description="Powerful search and filtering to find any transaction instantly. Search by amount, date, category, or description."
              icon={<FileText className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="Currency Support"
              description="Track investment accounts in different currencies. Supports CAD and other currencies for investment tracking."
              icon={<Sparkles className="w-4 h-4" />}
            />
            
            <AssistiveFeatureCard
              title="Data Privacy First"
              description="We never sell your data. Your financial information is yours alone, encrypted and secure."
              icon={<Lock className="w-4 h-4" />}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-background via-muted/10 to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4 tracking-tight leading-[1.1]">
              Ready to Take Control?
            </h3>
            <p className="text-base sm:text-lg text-muted-foreground font-light mb-8 leading-relaxed">
              Start your journey to better financial management with Spare Finance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-7 py-3 border border-border rounded-lg font-medium hover:border-primary/50 hover:bg-muted/50 transition-all duration-200"
              >
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

