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
    headline: "Grow your wealth with confidence",
    subheadline: "Track your investments, monitor performance, and build your portfolio all in one place",
    benefits: [
      {
        title: "Track all investments",
        description: "Monitor stocks, bonds, funds, and more in a unified dashboard.",
        icon: "BarChart3",
      },
      {
        title: "Real-time portfolio value",
        description: "See your total investment value and performance at a glance.",
        icon: "Wallet",
      },
      {
        title: "Investment history",
        description: "Keep track of contributions, dividends, and interest over time.",
        icon: "TrendingUp",
      },
    ],
    preview: {
      title: "Investment Portfolio",
      description: "View all your investment accounts, track contributions, and monitor performance",
    },
  },
  "Advanced Reports": {
    headline: "Make smarter financial decisions",
    subheadline: "Deep insights into your spending patterns, income trends, and Spare Score",
    benefits: [
      {
        title: "Detailed analytics",
        description: "Understand where your money goes with comprehensive reports.",
        icon: "BarChart3",
      },
      {
        title: "Trend analysis",
        description: "Track your financial progress over time with visual charts.",
        icon: "TrendingUp",
      },
      {
        title: "Custom date ranges",
        description: "Analyze any period to understand your financial patterns.",
        icon: "Calendar",
      },
    ],
    preview: {
      title: "Advanced Reports",
      description: "Get detailed insights into your finances with comprehensive analytics",
    },
  },
  "CSV Export": {
    headline: "Take control of your data",
    subheadline: "Export your financial data anytime for analysis, taxes, or backup",
    benefits: [
      {
        title: "Full data export",
        description: "Export all your transactions, accounts, and financial data.",
        icon: "Download",
      },
      {
        title: "Tax preparation",
        description: "Easily prepare your data for tax filing or accounting software.",
        icon: "FileText",
      },
      {
        title: "Data backup",
        description: "Keep a local copy of all your financial information.",
        icon: "HardDrive",
      },
    ],
    preview: {
      title: "CSV Export",
      description: "Export your financial data in CSV format for analysis and backup",
    },
  },
  "Unlimited Transactions": {
    headline: "Never worry about limits again",
    subheadline: "Record as many transactions as you need without restrictions",
    benefits: [
      {
        title: "No transaction limits",
        description: "Record unlimited transactions every month.",
        icon: "Infinity",
      },
      {
        title: "Complete financial picture",
        description: "Track every expense and income without worrying about limits.",
        icon: "BarChart3",
      },
      {
        title: "Full history",
        description: "Keep your complete financial history without restrictions.",
        icon: "BookOpen",
      },
    ],
    preview: {
      title: "Unlimited Transactions",
      description: "Record as many transactions as you need without any limits",
    },
  },
  "Unlimited Accounts": {
    headline: "Manage all your accounts",
    subheadline: "Connect and track unlimited bank accounts, credit cards, and investment accounts",
    benefits: [
      {
        title: "No account limits",
        description: "Add as many accounts as you need for complete financial tracking.",
        icon: "Building2",
      },
      {
        title: "All account types",
        description: "Track checking, savings, credit cards, investments, and more.",
        icon: "CreditCard",
      },
      {
        title: "Unified view",
        description: "See all your accounts in one place with a complete overview.",
        icon: "Eye",
      },
    ],
    preview: {
      title: "Unlimited Accounts",
      description: "Add and manage unlimited accounts for complete financial tracking",
    },
  },
  Debts: {
    headline: "Take control of your debts",
    subheadline: "Track, prioritize, and pay off your debts faster with smart tools",
    benefits: [
      {
        title: "Debt tracking",
        description: "Monitor all your debts in one place with balances and interest rates.",
        icon: "BarChart3",
      },
      {
        title: "Payment prioritization",
        description: "See which debts to pay first to save on interest.",
        icon: "Target",
      },
      {
        title: "Payoff timeline",
        description: "Visualize when you'll be debt-free with different payment strategies.",
        icon: "Calendar",
      },
    ],
    preview: {
      title: "Debt Management",
      description: "Track and manage all your debts with smart prioritization tools",
    },
  },
  Goals: {
    headline: "Achieve your financial goals",
    subheadline: "Set savings goals, track progress, and reach your targets faster",
    benefits: [
      {
        title: "Goal setting",
        description: "Create and track multiple savings goals with target dates.",
        icon: "Target",
      },
      {
        title: "Progress tracking",
        description: "See how close you are to each goal with visual progress indicators.",
        icon: "TrendingUp",
      },
      {
        title: "ETA calculation",
        description: "Know exactly when you'll reach your goals based on your savings rate.",
        icon: "Clock",
      },
    ],
    preview: {
      title: "Financial Goals",
      description: "Set and track your savings goals with progress indicators and ETA",
    },
  },
  "Household Members": {
    headline: "Manage your family finances together",
    subheadline: "Add family members to track finances separately while staying organized",
    benefits: [
      {
        title: "Family accounts",
        description: "Add multiple family members with separate financial tracking.",
        icon: "Users",
      },
      {
        title: "Individual tracking",
        description: "Each member has their own transactions, accounts, and budgets.",
        icon: "User",
      },
      {
        title: "Unified overview",
        description: "See the complete household financial picture in one place.",
        icon: "Home",
      },
    ],
    preview: {
      title: "Household Members",
      description: "Add family members to track finances separately while staying organized",
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

