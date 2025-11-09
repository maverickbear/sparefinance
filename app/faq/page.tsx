"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SimpleFooter } from "@/components/common/simple-footer";
import { HelpCircle, ArrowLeft, Wallet } from "lucide-react";

export default function FAQPage() {
  const faqCategories = [
    {
      title: "About Spare Finance",
      questions: [
        {
          question: "What is Spare Finance?",
          answer: "Spare Finance is a complete personal finance management platform that allows you to control your finances in a centralized and intelligent way. With it, you can manage transactions, budgets, investments, debts, and savings goals all in one place.",
        },
        {
          question: "How does Spare Finance work?",
          answer: "Spare Finance works as a command center for your personal finances. You can connect your bank accounts, manually record transactions, or import data via CSV. The platform automatically organizes your transactions into categories, allows you to create monthly budgets, track investments, and set savings goals.",
        },
        {
          question: "Do I need technical knowledge to use it?",
          answer: "No! Spare Finance is designed to be intuitive and easy to use. The interface is modern and simple, allowing anyone to manage their finances without prior technical knowledge.",
        },
        {
          question: "Is Spare Finance secure?",
          answer: "Yes! We implement enterprise-level security measures, including end-to-end encryption for data transmission, secure storage with encryption at rest, secure authentication via Supabase Auth, and Row Level Security (RLS) to ensure your data is isolated and protected at the database level.",
        },
      ],
    },
    {
      title: "Plans and Pricing",
      questions: [
        {
          question: "What plans are available?",
          answer: "We offer three plans: FREE (free), BASIC ($7.99/month or $79.90/year) and PREMIUM ($14.99/month or $149.90/year). The FREE plan allows up to 50 transactions per month and 2 accounts. The BASIC plan offers 500 transactions per month and 10 accounts, including all features. The PREMIUM plan offers unlimited resources.",
        },
        {
          question: "What is included in the FREE plan?",
          answer: "The FREE plan includes: basic transaction management (up to 50/month), 2 bank accounts, budget creation, debt management, savings goals definition, and access to the basic dashboard. It does not include investments, advanced reports, CSV export, bank integration, or family members.",
        },
        {
          question: "What features are available in the BASIC plan?",
          answer: "The BASIC plan includes all FREE plan features, plus: complete investments, advanced reports, CSV import/export, bank integration via Plaid, family member management (household members), AI-powered intelligent categorization, and up to 500 transactions per month and 10 accounts.",
        },
        {
          question: "What's the difference between BASIC and PREMIUM?",
          answer: "The PREMIUM plan offers everything the BASIC plan offers, but with unlimited resources: unlimited transactions per month and unlimited accounts. It's ideal for users with high transaction volume and multiple bank accounts.",
        },
        {
          question: "Can I change plans at any time?",
          answer: "Yes! You can upgrade or downgrade your plan at any time through your account settings. Upgrade changes are applied immediately, while downgrades are applied at the end of your current billing period.",
        },
        {
          question: "Is there a discount for annual payment?",
          answer: "Yes! We offer a 17% discount when you choose annual payment. The BASIC plan costs $79.90/year (equivalent to $6.66/month) and the PREMIUM plan costs $149.90/year (equivalent to $12.49/month).",
        },
        {
          question: "Can I cancel my subscription?",
          answer: "Yes, you can cancel your subscription at any time through your account settings. The cancellation will take effect at the end of your current billing period, and you will continue to have access until then.",
        },
      ],
    },
    {
      title: "Features",
      questions: [
        {
          question: "How does bank integration work?",
          answer: "Bank integration is done through Plaid, a secure and reliable platform used by thousands of financial applications. You securely connect your bank accounts, and Spare Finance automatically imports your transactions. This feature is available on BASIC and PREMIUM plans.",
        },
        {
          question: "Can I import transactions from a CSV file?",
          answer: "Yes! On BASIC and PREMIUM plans, you can import transactions from CSV files. The system allows you to map your file columns to the correct fields, making it easy to import historical data or data from other systems.",
        },
        {
          question: "How do budgets work?",
          answer: "You can create monthly budgets by category. The system automatically tracks your spending and shows visual progress with progress bars. Colors indicate status: green (≤90% of budget), yellow (90-100%) and red (>100%).",
        },
        {
          question: "Can I manage investments in Spare Finance?",
          answer: "Yes! On BASIC and PREMIUM plans, you can manage complete investments: create investment accounts (TFSA, RRSP, crypto wallet, etc.), manage securities (stocks, ETFs, crypto, bonds, REITs), record transactions (buy, sell, dividends, interest), calculate holdings with weighted average cost, and track portfolio value.",
        },
        {
          question: "How do savings goals work?",
          answer: "You can define savings goals with specific amounts and deadlines. The system automatically calculates how much you need to save per month based on a percentage of your income and shows an estimate of when you will reach your goal (ETA).",
        },
        {
          question: "Can I share my account with family members?",
          answer: "Yes! On BASIC and PREMIUM plans, you can add family members to your account. This allows multiple people to view and manage shared finances, ideal for couples and families who want to manage their finances together.",
        },
        {
          question: "How does automatic categorization work?",
          answer: "Spare Finance uses artificial intelligence to learn from your previous categorizations and automatically suggest categories for new transactions. The more you use it, the more accurate the system becomes.",
        },
      ],
    },
    {
      title: "Account and Support",
      questions: [
        {
          question: "How do I create an account?",
          answer: "You can create a free account by clicking 'Get Started' on the homepage. The process is quick and simple: just provide your email, create a password, and confirm your email. No credit card is required to get started.",
        },
        {
          question: "I forgot my password. How do I recover it?",
          answer: "On the login page, click 'Forgot my password' and enter your email. You will receive a link to reset your password. Make sure to check your inbox and spam folder.",
        },
        {
          question: "How do I update my payment information?",
          answer: "You can update your payment information at any time in your account settings, in the 'Billing' section. The system uses Stripe to process payments securely.",
        },
        {
          question: "Is my data private?",
          answer: "Absolutely! Your financial data is private and protected. We implement Row Level Security (RLS) in the database, ensuring that only you (and authorized family members) can access your data. We never sell or share your financial information with third parties.",
        },
        {
          question: "How do I contact support?",
          answer: "You can contact our support via email at support@sparefinance.com or through the 'Help & Support' section within the application. Our team is ready to help with any questions or issues.",
        },
        {
          question: "Does Spare Finance offer support in other languages?",
          answer: "Yes! Spare Finance is available in multiple languages and we offer support in various languages. Our team is prepared to help you in your preferred language.",
        },
        {
          question: "Can I export my data?",
          answer: "Yes! On BASIC and PREMIUM plans, you can export all your transactions in CSV format at any time. This allows you to keep a backup of your data or use it in other tools.",
        },
        {
          question: "What happens if I delete my account?",
          answer: "If you delete your account, all your data will be permanently removed from our system within 30 days, in accordance with our privacy policy. This action cannot be undone, so make sure to export your data beforehand if you want to keep it.",
        },
      ],
    },
    {
      title: "Technical and Compatibility",
      questions: [
        {
          question: "What devices does Spare Finance work on?",
          answer: "Spare Finance is a responsive web application that works on any device with a modern browser: desktop computers, tablets, and smartphones. No need to install apps - just access through your browser.",
        },
        {
          question: "Which browsers are supported?",
          answer: "Spare Finance works on all modern browsers, including Chrome, Firefox, Safari, Edge, and Opera. We always recommend using the latest version of your browser for better performance and security.",
        },
        {
          question: "Does Spare Finance work offline?",
          answer: "Currently, Spare Finance requires an internet connection to function. We are working on offline features for the future, allowing you to view and edit transactions even without a connection.",
        },
        {
          question: "Is my data stored in the cloud?",
          answer: "Yes, your data is securely stored in the cloud using Supabase (PostgreSQL). This allows you to access your information from any device and ensures your data is always secure with automatic backups.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-[12px]">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold">Spare Finance</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <HelpCircle className="h-10 w-10 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Frequently Asked Questions
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Find answers to the most common questions about Spare Finance
            </p>
          </div>

          {/* FAQ Categories */}
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-4">
              <h2 className="text-2xl font-semibold mb-4">{category.title}</h2>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {category.questions.map((faq, faqIndex) => {
                  const itemId = `${categoryIndex}-${faqIndex}`;
                  return (
                    <AccordionItem key={faqIndex} value={itemId}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ))}

          {/* Still have questions */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Still have questions?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Didn't find the answer you were looking for? Our support team is ready to help!
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:support@sparefinance.com"
                    className="text-primary hover:underline"
                  >
                    support@sparefinance.com
                  </a>
                </p>
                <p>
                  <strong>In-app support:</strong>{" "}
                  <Link
                    href="/help-support"
                    className="text-primary hover:underline"
                  >
                    Visit Help & Support
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Simple Footer */}
      <SimpleFooter />
    </div>
  );
}

