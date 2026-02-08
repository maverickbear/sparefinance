"use client";

import { FeatureSpotlightSection } from "./feature-spotlight-section";

const FEATURES = [
  {
    image: "dashboard.jpg",
    imageAlt: "Dashboard with Spare Score and your money in one place",
    title: "Your money in one place, with a clear health score.",
    tagline: "Stay on top of your finances with Spare Finance",
    description:
      "The dashboard shows all your accounts, recent activity, and your Spare Score in one view. See where you stand and what to do next—no more jumping between apps or spreadsheets.",
    reverse: false,
  },
  {
    image: "budgets.jpg",
    imageAlt: "Budgets and savings goals",
    title: "Set limits and targets. See progress and stay on track.",
    tagline: "Budgets and goals that actually work",
    description:
      "Create monthly budgets by category and set savings goals with a clear timeline. Track spending against your budget and watch your goals move forward. You stay in control, month after month.",
    reverse: true,
  },
  {
    image: "planning.jpg",
    imageAlt: "Reports and planned payments",
    title: "Understand patterns. Plan payments and cash flow.",
    tagline: "Reports and planning in one place",
    description:
      "See where your money goes with clear reports and trends. Planned payments show what's due in the next 90 days—recurring, debts, goals, and subscriptions—so you can plan with confidence.",
    reverse: false,
  },
  {
    image: "family.jpg",
    imageAlt: "Household managing money together",
    title: "Manage money together.",
    tagline: "Household sharing with Spare Finance",
    description:
      "Invite your partner or family to the same household. Share accounts, budgets, and goals so everyone is aligned. Build wealth together, not just pay bills alone.",
    reverse: true,
  },
];

export function FeaturesShowcase() {
  return (
    <section id="features" className="scroll-mt-20">
      {FEATURES.map((feature, i) => (
        <FeatureSpotlightSection key={i} {...feature} />
      ))}
    </section>
  );
}
