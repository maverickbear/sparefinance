export interface FeaturePromotion {
  headline: string;
  subheadline: string;
  benefits: {
    title: string;
    description: string;
    icon: string; // Icon name from lucide-react
  }[];
  preview?: {
    title: string;
    description: string;
  };
}

export const featurePromotions: Record<string, FeaturePromotion> = {
  Investments: {
    headline: "Stop losing track of your investments across multiple platforms",
    subheadline: "Track all your investments, performance, and asset allocation in one place. Know exactly how your money is growing—or where it's not.",
    benefits: [
      {
        title: "Real-time portfolio tracking",
        description: "See your total portfolio value update in real-time. Track day-to-day changes, total returns, and performance metrics all in one dashboard.",
        icon: "Wallet",
      },
      {
        title: "Asset allocation insights",
        description: "Understand your diversification with visual breakdowns by asset type and sector. Spot over-concentration risks before they become problems.",
        icon: "TrendingUp",
      },
    ],
    preview: {
      title: "Investment Portfolio",
      description: "Read about investment accounts and how to track your portfolio performance over time",
    },
  },
  "Advanced Reports": {
    headline: "Stop guessing where your money goes—see it clearly",
    subheadline: "Basic reports only show you what you spent. Advanced Reports reveal why you're overspending, when you're most vulnerable to impulse buys, and how your habits change over time. Make data-driven decisions instead of financial guesses.",
    benefits: [
      {
        title: "Spending pattern analysis",
        description: "Discover which categories drain your budget most. See if you're spending more on dining out than groceries, or if subscriptions are eating your income.",
        icon: "BarChart3",
      },
      {
        title: "Income vs expenses trends",
        description: "Track your cash flow over months and years. Spot seasonal patterns, income gaps, and spending spikes before they become problems.",
        icon: "TrendingUp",
      },
      {
        title: "Custom date range analysis",
        description: "Compare any two periods—this month vs last month, this year vs last year. See if your financial habits are actually improving or getting worse.",
        icon: "Calendar",
      },
    ],
    preview: {
      title: "Advanced Reports",
      description: "Read about available report types, how to analyze spending patterns, and how to use custom date ranges for financial analysis",
    },
  },
  "CSV Export": {
    headline: "Stop being locked into one platform—own your financial data",
    subheadline: "Your financial data shouldn't be trapped in one app. Export everything—transactions, accounts, categories—in CSV format for taxes, Excel analysis, or backup. Your data, your control, anytime you need it.",
    benefits: [
      {
        title: "Complete data export",
        description: "Export all transactions with dates, amounts, categories, and accounts. Get everything you need for tax preparation or financial analysis.",
        icon: "Download",
      },
      {
        title: "Tax-ready format",
        description: "Export in formats compatible with tax software and accounting tools. No more manual data entry during tax season.",
        icon: "FileText",
      },
      {
        title: "Local backup protection",
        description: "Keep a local copy of your financial history. Never lose access to your data, even if you cancel your subscription.",
        icon: "HardDrive",
      },
    ],
    preview: {
      title: "CSV Export",
      description: "Learn how to export your data, what formats are supported, and how to use exported data for tax preparation",
    },
  },
  "Unlimited Transactions": {
    headline: "Stop hitting transaction limits that cut off your financial history",
    subheadline: "You track every coffee, every bill, every income—until you hit a limit and can't add more. Your financial picture gets incomplete, reports become inaccurate, and you lose visibility. Record unlimited transactions and keep your complete financial story intact.",
    benefits: [
      {
        title: "No monthly limits",
        description: "Record 10 transactions or 10,000—no restrictions. Track every expense, no matter how small, without worrying about hitting a cap.",
        icon: "Infinity",
      },
      {
        title: "Complete financial accuracy",
        description: "Your reports and budgets stay accurate because every transaction is recorded. No more missing data skewing your financial picture.",
        icon: "BarChart3",
      },
      {
        title: "Full historical data",
        description: "Keep years of transaction history without deletion. Your complete financial story, always accessible for analysis and planning.",
        icon: "BookOpen",
      },
    ],
    preview: {
      title: "Unlimited Transactions",
      description: "Learn about transaction limits, how unlimited transactions improve your financial tracking, and best practices for recording transactions",
    },
  },
  "Unlimited Accounts": {
    headline: "Stop juggling multiple accounts across different apps",
    subheadline: "You have checking, savings, credit cards, investment accounts, and maybe a business account. Each one is tracked separately, making it impossible to see your true net worth or cash flow. Connect unlimited accounts and see everything in one unified dashboard.",
    benefits: [
      {
        title: "No account restrictions",
        description: "Add every account you have—personal, joint, business, investment. No limits means no compromises on your financial visibility.",
        icon: "Building2",
      },
      {
        title: "All account types supported",
        description: "Checking, savings, credit cards, lines of credit, investment accounts, and more. Track everything, regardless of account type.",
        icon: "CreditCard",
      },
      {
        title: "True net worth calculation",
        description: "See your real financial position by including all accounts. Know your actual net worth, not just what's in one account.",
        icon: "Eye",
      },
    ],
    preview: {
      title: "Unlimited Accounts",
      description: "Read about supported account types, how to add multiple accounts, and how to manage all your accounts in one place",
    },
  },
  Debts: {
    headline: "Stop paying more interest than you need to",
    subheadline: "You have credit cards, loans, and debts scattered across different accounts. You're making minimum payments but don't know which debt to prioritize. See exactly which debt costs you the most in interest, get a payoff strategy, and watch your debt-free date move closer.",
    benefits: [
      {
        title: "All debts in one view",
        description: "See every credit card, loan, mortgage, and debt with current balances and interest rates. No more logging into multiple accounts to see what you owe.",
        icon: "BarChart3",
      },
      {
        title: "Smart payoff strategies",
        description: "Compare avalanche (highest interest first) vs snowball (smallest balance first) methods. See which saves you more money and time.",
        icon: "Target",
      },
      {
        title: "Debt-free date calculator",
        description: "See exactly when you'll be debt-free with your current payments. Adjust payment amounts and watch your payoff date move closer in real-time.",
        icon: "Calendar",
      },
    ],
    preview: {
      title: "Debt Management",
      description: "Learn about debt tracking features, payoff strategies, and how to calculate your debt-free date",
    },
  },
  Goals: {
    headline: "Stop saving aimlessly—know exactly when you'll reach your goals",
    subheadline: "You want to save for a house, vacation, or emergency fund, but you're just putting money aside without a plan. Set specific goals with deadlines, track your progress, and see exactly when you'll reach them based on your actual savings rate.",
    benefits: [
      {
        title: "Multiple goals with deadlines",
        description: "Create separate goals for your emergency fund, vacation, down payment, or any target. Set realistic deadlines and track each one independently.",
        icon: "Target",
      },
      {
        title: "Visual progress tracking",
        description: "See your progress bar fill up as you save. Watch how close you are to each goal and stay motivated with real numbers, not vague hopes.",
        icon: "TrendingUp",
      },
      {
        title: "Automatic ETA calculation",
        description: "Based on your actual monthly savings, see exactly when you'll reach each goal. Adjust your savings rate and watch the timeline update instantly.",
        icon: "Clock",
      },
    ],
    preview: {
      title: "Financial Goals",
      description: "Read about goal setting, progress tracking, and how ETA calculations help you reach your targets faster",
    },
  },
  "Household Members": {
    headline: "Stop mixing your finances with your partner's or family's",
    subheadline: "You share expenses but track money separately. Or you want to see the full household picture without losing individual privacy. Add family members, track each person's spending independently, and see the complete household financial health in one dashboard.",
    benefits: [
      {
        title: "Separate financial tracking",
        description: "Each family member has their own transactions, accounts, and budgets. No more confusion about whose spending is whose.",
        icon: "Users",
      },
      {
        title: "Individual privacy maintained",
        description: "Members can see their own data while you see the household overview. Perfect for couples who want transparency without micromanaging each other.",
        icon: "User",
      },
      {
        title: "Complete household view",
        description: "See total household income, expenses, and net worth in one place. Make family financial decisions with complete information.",
        icon: "Home",
      },
    ],
    preview: {
      title: "Household Members",
      description: "Learn how to add family members, manage individual and household finances, and maintain privacy while sharing financial data",
    },
  },
  Budgets: {
    headline: "Stop overspending before it happens—not after",
    subheadline: "You set a budget in your head, then wonder where all your money went at month's end. Create real budgets that track spending in real-time. Get alerts before you hit your limit, not after you've already overspent.",
    benefits: [
      {
        title: "Category-based budgets",
        description: "Set limits for groceries, dining out, entertainment, or any category. See exactly where you're spending too much and where you have room.",
        icon: "Target",
      },
      {
        title: "Real-time spending vs budget",
        description: "Watch your budget fill up as transactions come in. See at a glance if you're on track or about to overspend—before it's too late.",
        icon: "BarChart3",
      },
      {
        title: "Smart budget alerts",
        description: "Get notified when you're 80% through your budget, not when you've already exceeded it. Make adjustments while you still can.",
        icon: "Clock",
      },
    ],
    preview: {
      title: "Budget Management",
      description: "Read about creating budgets, setting spending limits, and how real-time tracking helps you stay within budget",
    },
  },
  "CSV Import": {
    headline: "Stop manually entering years of transaction history",
    subheadline: "You've been tracking expenses in spreadsheets or other apps for months—maybe years. Don't lose that data. Import thousands of transactions in seconds, automatically categorized and ready to analyze. Your financial history, preserved and organized.",
    benefits: [
      {
        title: "Import thousands instantly",
        description: "Upload CSV files with years of transactions. Our system processes thousands of rows in seconds, not hours of manual entry.",
        icon: "Download",
      },
      {
        title: "Works with any bank format",
        description: "Whether it's TD, RBC, CIBC, or any other bank's CSV export, we handle the format differences. Just upload and map your columns.",
        icon: "FileText",
      },
      {
        title: "AI auto-categorization",
        description: "Every imported transaction gets automatically categorized using our AI. No more spending hours assigning categories to old transactions.",
        icon: "Sparkles",
      },
    ],
    preview: {
      title: "CSV Import",
      description: "Learn about supported CSV formats, how to map columns, and how automatic categorization works for imported transactions",
    },
  },
  "Bank Integration": {
    headline: "Stop manually entering every transaction—let your bank do it",
    subheadline: "You're spending hours each month typing in transactions, categorizing expenses, and trying to remember what you bought. Connect your bank accounts once and watch every transaction sync automatically. Your time is worth more than data entry.",
    benefits: [
      {
        title: "Automatic transaction sync",
        description: "Every purchase, bill payment, and deposit appears automatically. No more manual entry, no more forgotten transactions, no more incomplete records.",
        icon: "CreditCard",
      },
      {
        title: "Works with major Canadian banks",
        description: "Connect TD, RBC, CIBC, BMO, Scotiabank, and thousands more through Plaid. Your bank, your data, automatically synced.",
        icon: "Building2",
      },
      {
        title: "Bank-level security",
        description: "Plaid's SOC 2 Type 2 certified infrastructure. We never see or store your bank credentials. Read-only access means we can't move your money—ever.",
        icon: "CheckCircle2",
      },
    ],
    preview: {
      title: "Bank Integration",
      description: "Read about supported banks, how Plaid integration works, and security measures for connecting your accounts",
    },
  },
};

export function getFeaturePromotion(featureName: string): FeaturePromotion {
  return (
    featurePromotions[featureName] || {
      headline: `Unlock ${featureName}`,
      subheadline: `${featureName} is not available in your current plan. Upgrade to access this feature.`,
      benefits: [
        {
          title: `Access ${featureName}`,
          description: `Get full access to ${featureName} and all its features.`,
          icon: "Sparkles",
        },
        {
          title: "More features",
          description: "Unlock additional features and capabilities with your upgrade.",
          icon: "Rocket",
        },
        {
          title: "Priority support",
          description: "Get priority support and faster response times.",
          icon: "MessageCircle",
        },
      ],
    }
  );
}

