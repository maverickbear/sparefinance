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
      question: "How can this help my family organize our finances?",
      answer: "Spare Finance helps you track every expense so you know exactly where your money goes. You can see spending by category, set budgets together, and share financial information with family members. It's a place where families learn to organize their finances and make better decisions together.",
    },
    {
      question: "How do I learn where I'm spending too much?",
      answer: "Connect your bank accounts or add transactions manually, and you'll see all your spending organized by category. The Spare Score shows your financial health, and you'll get insights about your spending patterns. You can see which categories take most of your money and learn where to cut back.",
    },
    {
      question: "Can my family see our finances together?",
      answer: "Yes! You can invite family members to your household. Everyone can see shared accounts, budgets, and financial goals. You work together to organize finances while keeping individual accounts separate. It's perfect for families learning to manage money together.",
    },
    {
      question: "How does Spare Score help me learn about my finances?",
      answer: "Spare Score (0-100) shows your financial health based on your spending vs income. It also shows your savings rate, spending discipline, and debt exposure. The insights help you understand where you stand and what to improve. It's like a report card for your finances that helps you learn.",
    },
    {
      question: "How can I learn to save money?",
      answer: "Set savings goals and see exactly when you'll reach them. Track your progress with visual indicators. The app shows you where you're spending money, so you can identify areas to save. Get insights based on your actual spending to learn what changes will help you save more.",
    },
    {
      question: "Do I need to connect my bank account?",
      answer: "Yes, you can add transactions manually or import from CSV files. This helps you track everything and maintain full control over your financial data.",
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

