/**
 * Static blog posts data (personal finance content).
 * Used by BlogService. Add new posts here or migrate to MD/CMS later.
 */

import type { BlogPost } from "@/src/domain/blog/blog.types";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-build-a-simple-monthly-budget",
    title: "How to Build a Simple Monthly Budget That Actually Works",
    description:
      "A step-by-step guide to creating a realistic monthly budget, tracking spending, and staying on track without feeling overwhelmed.",
    datePublished: "2025-02-01",
    dateModified: "2025-02-09",
    author: "Cody Fisher",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cody",
    image: {
      src: "/landing/hero.jpg",
      alt: "People planning finances in a meeting",
      width: 800,
      height: 500,
    },
    tags: ["Budget", "Tips"],
    keywords: ["budget", "monthly budget", "personal finance", "saving money", "expense tracking"],
    body: `Tracking your money doesn't have to be complicated. A simple monthly budget helps you see where your money goes and make room for what matters.

Start by listing your income: salary, side gigs, and any other regular cash coming in. Use your take-home amount so you're working with real numbers.

Next, list fixed expenses: rent or mortgage, utilities, insurance, subscriptions, and loan payments. These are the same (or close) every month.

Then add variable expenses: groceries, gas, dining out, entertainment. Look at the last few months of spending to set realistic amounts. Don't guess—use real data if you have it.

Finally, set a goal for saving or paying off debt. Even a small amount each month builds the habit and adds up over time.

Review your budget at least once a month. Adjust categories as life changes. The goal isn't perfection—it's awareness and control so you can move from anxiety to clarity.`,
  },
  {
    slug: "why-tracking-expenses-leads-to-financial-peace",
    title: "Why Tracking Your Expenses Is the First Step to Financial Peace",
    description:
      "Understanding where your money goes reduces stress and helps you make better decisions. Here's why expense tracking works and how to start.",
    datePublished: "2025-02-05",
    author: "Guy Hawkins",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guy",
    image: {
      src: "/landing/dashboard.jpg",
      alt: "Financial control dashboard",
      width: 600,
      height: 400,
    },
    tags: ["Spending", "Tips"],
    keywords: ["expense tracking", "personal finance", "money management", "financial health", "spending"],
    body: `You can't improve what you don't measure. When you track your expenses, you stop guessing and start knowing.

Many people avoid looking at their spending because it feels stressful. But the real stress comes from not knowing—wondering if there's enough, or where it all went. Tracking turns that uncertainty into clarity.

You don't need to track every penny forever. Even a few weeks of honest logging will show patterns: where you spend the most, where small leaks add up, and where you're already doing well.

Use categories that match your life: groceries, transport, subscriptions, eating out, and so on. The goal is to see the big picture, not to judge every coffee.

Once you see the picture, you can set simple goals: spend a bit less on one category, save a fixed amount each month, or pay down debt. Small, consistent steps lead to real change.`,
  },
  {
    slug: "how-to-get-out-of-debt-without-desperation",
    title: "How to Get Out of Debt Without Desperation",
    description:
      "Practical strategies to pay down debt sustainably: snowball method, prioritization, and habit changes without sacrificing everything.",
    datePublished: "2025-02-07",
    dateModified: "2025-02-09",
    author: "Floyd Miles",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Floyd",
    image: {
      src: "/landing/planning.jpg",
      alt: "Financial planning and goals",
      width: 600,
      height: 400,
    },
    tags: ["Debt", "Planning"],
    keywords: ["debt", "pay off debt", "personal finance", "financial freedom"],
    body: `Getting out of debt is more about consistency than miracles. The first step is to get a clear picture: list all debts, interest rates, and minimum payments.

Two common approaches: the "snowball" (pay off the smallest debt first for motivation) and the "avalanche" (tackle the highest-interest debt first). Both work; choose the one you'll stick with.

Protect a minimal emergency fund before throwing every extra dollar at debt. That way you avoid new loans when the unexpected happens.

Adjust habits gradually: cut one subscription, trim one spending habit, but don't try to change everything at once. Small wins keep you going.

Celebrate each debt you clear. Acknowledging progress keeps you in the game until the last payment.`,
  },
  {
    slug: "emergency-fund-where-to-start",
    title: "Emergency Fund: Where to Start",
    description:
      "Why everyone needs an emergency fund and how to build yours, even on a tight budget. Realistic targets and where to keep the money.",
    datePublished: "2025-02-08",
    author: "Maria Silva",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    image: {
      src: "/landing/family.jpg",
      alt: "Family and financial planning",
      width: 600,
      height: 400,
    },
    tags: ["Savings", "Emergency Fund"],
    keywords: ["emergency fund", "savings", "personal finance", "financial security"],
    body: `An emergency fund is the foundation of financial security. It covers the unexpected—job loss, health issues, repairs—without relying on credit cards or loans.

A common target is 3 to 6 months of essential expenses. If that feels far off, start smaller: one month, or even your first thousand. What matters is starting.

Where to keep it: in an account that earns a little and allows quick access—savings or a liquid investment. Avoid locking this money in long-term investments.

Set aside a fixed amount every month, even if it's small. Automate a transfer to a separate account as soon as you get paid. Over time, the fund grows without depending on "what's left over."

Revisit the size of your fund when your expenses or income change. This simple habit reduces anxiety and frees you for other goals, like investing or big life plans.`,
  },
];
