"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQSection() {
  const faqs = [
    {
      question: "Why isn't it free?",
      answer: "Great question! We offer a full 30-day free trial with no credit card needed, so you can experience everything we offer and decide if it's right for you. We're building something special that we want to keep improving for years to come. To deliver secure bank connections, reliable service, and new features that actually help you, we need to keep the lights on. Think of it as investing in a tool that grows with you—we're here for the long haul, not just a quick project.",
    },
    {
      question: "What's included in the 30-day free trial?",
      answer: "Everything! Your 30-day trial gives you full access to all Pro features—unlimited transactions, bank integrations, budgets, goals, receipt scanning, investment tracking, advanced reports, CSV import/export, debt management, and household sharing. No credit card required, no hidden fees, and you can cancel anytime during the trial. It's the perfect way to see if Spare Finance fits your financial journey.",
    },
    {
      question: "How can this help my family organize our finances?",
      answer: "Spare Finance helps you track every expense so you know exactly where your money goes. You can see spending by category, set budgets together, and share financial information with family members through our household feature. Create shared budgets for groceries, utilities, or family goals. Everyone can see the same financial picture while keeping personal accounts separate. It's a place where families learn to organize their finances and make better decisions together, with real-time updates and collaborative planning tools.",
    },
    {
      question: "How do I learn where I'm spending too much?",
      answer: "Connect your bank accounts or add transactions manually, and you'll see all your spending organized by category with visual charts and trends. The Spare Score shows your financial health at a glance, and you'll get personalized insights about your spending patterns. Our budget tracking feature compares your actual spending against your planned budgets, highlighting categories where you're over. You can drill down into specific time periods, see spending trends over months, and identify areas where small changes can make a big difference.",
    },
    {
      question: "Can my family see our finances together?",
      answer: "Yes! You can invite family members to your household with different permission levels (owner, admin, or member). Everyone can see shared accounts, budgets, financial goals, and household-level reports. You work together to organize finances while keeping individual accounts separate and private. Real-time synchronization means everyone sees updates instantly. It's perfect for families learning to manage money together, planning shared expenses, and achieving common financial goals.",
    },
    {
      question: "How does Spare Score help me learn about my finances?",
      answer: "Spare Score (0-100) is your financial health dashboard. It analyzes your spending vs income, savings rate, spending discipline, debt exposure, and goal progress. The score updates as your financial habits change, giving you immediate feedback on your decisions. Detailed breakdowns show exactly what's affecting your score—whether it's high spending in certain categories, debt levels, or savings progress. It's like a report card for your finances that helps you understand where you stand and what to improve, with actionable insights tailored to your situation.",
    },
    {
      question: "How can I learn to save money?",
      answer: "Set savings goals with target amounts and deadlines, and see exactly when you'll reach them based on your current savings rate. Track your progress with visual indicators and milestone celebrations. The app shows you where you're spending money through detailed category breakdowns, so you can identify areas to save. Get insights based on your actual spending patterns to learn what changes will help you save more. Create multiple goals simultaneously—emergency fund, vacation, down payment—and see how your spending choices impact each goal. Budget features help you allocate money toward savings before you spend it.",
    },
    {
      question: "Do I need to connect my bank account?",
      answer: "No, you have full control! You can add transactions manually, import from CSV files, or connect your bank accounts for automatic syncing. Manual entry gives you complete privacy and control over your data. CSV import is perfect for bulk transactions or if you prefer to export from your bank and import periodically. Bank integration (via Plaid) offers automatic transaction syncing for convenience. You can mix and match approaches—some accounts connected, others manual—whatever works best for your comfort level and needs.",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            FAQ
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Frequently Asked<br />Questions
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-4">
                <AccordionTrigger className="text-left text-base font-semibold py-3">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

