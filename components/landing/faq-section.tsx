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
      question: "What is Spare Score and how does it work?",
      answer: "Spare Score is an AI-powered financial health metric (0-100) that evaluates your financial situation based on your expense ratio (expenses vs income). It also tracks your savings rate, spending discipline, and debt exposure. Higher scores indicate better financial health, and the system provides personalized insights to help you improve.",
    },
    {
      question: "How does bank integration work?",
      answer: "Bank integration uses Plaid, a secure platform trusted by thousands of financial apps. You connect your accounts through Plaid's secure interface—we never store your bank credentials. Transactions and balances sync automatically. This feature is available on Essential and Pro plans.",
    },
    {
      question: "Can I track investments?",
      answer: "Yes! Spare Finance supports Questrade integration for Canadian investors. Connect your Questrade account to automatically sync investment accounts, holdings, transactions, and portfolio values. You can also manually track investments from other brokers.",
    },
    {
      question: "How does the AI categorization work?",
      answer: "Our smart categorization system learns from your transaction history and automatically suggests categories. The more transactions you approve, the better it gets at recognizing your spending patterns. You can approve with one click or adjust as needed.",
    },
    {
      question: "Can I share my finances with family members?",
      answer: "Yes! Spare Finance supports household sharing. Invite family members to your household, and you can share accounts, budgets, and get a unified financial overview while keeping individual accounts separate.",
    },
    {
      question: "Can I import data from CSV files?",
      answer: "Yes! On Essential and Pro plans, you can import transactions from CSV files. The system allows you to map your file columns to the correct fields (date, amount, description, category, etc.). You can also export all your transactions to CSV at any time.",
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
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-lg font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
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

