"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { SimpleFooter } from "@/components/common/simple-footer";
import { Logo } from "@/components/common/logo";
import { HelpCircle, ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FAQPage() {
  const [plans, setPlans] = useState<Array<{ id: string; name: string; priceMonthly: number; priceYearly: number }>>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch plans from public API
    fetch("/api/billing/plans/public")
      .then(res => res.json())
      .then(data => {
        if (data.plans) {
          setPlans(data.plans);
        }
      })
      .catch(err => console.error("Error fetching plans:", err));
  }, []);

  const essentialPlan = plans.find(p => p.id === 'essential');
  const proPlan = plans.find(p => p.id === 'pro');
  const essentialPlanName = essentialPlan?.name || 'ESSENTIAL';
  const proPlanName = proPlan?.name || 'PRO';
  const essentialPriceMonthly = essentialPlan?.priceMonthly || 7.99;
  const essentialPriceYearly = essentialPlan?.priceYearly || 79.90;
  const proPriceMonthly = proPlan?.priceMonthly || 14.99;
  const proPriceYearly = proPlan?.priceYearly || 149.90;

  const faqCategories = useMemo(() => [
    {
      title: "About Spare Finance",
      questions: [
        {
          question: "What is Spare Finance?",
          answer: "Spare Finance is a simple app that helps you manage all your money in one place. You can track your spending, set budgets, save for goals, and see where your money goes—all in one easy-to-use platform.",
        },
        {
          question: "How does Spare Finance work?",
          answer: "It's really simple! You can connect your bank account (it's safe and secure), or you can add your transactions manually. The app automatically sorts your spending into categories, helps you create budgets, and shows you how much you're saving. Everything is organized so you can see your finances at a glance.",
        },
        {
          question: "Do I need to be tech-savvy to use it?",
          answer: "Not at all! Spare Finance is designed for everyone. The interface is clean and easy to understand. If you can use a smartphone or computer, you can use Spare Finance. No special skills needed!",
        },
        {
          question: "Is my financial information safe?",
          answer: "Absolutely! We use the same security measures that banks use. Your data is encrypted (scrambled so only you can read it), and we never share your information with anyone. Your login details are handled by secure systems, and we follow strict privacy rules to keep your money information private.",
        },
      ],
    },
    {
      title: "Plans and Pricing",
      questions: [
        {
          question: "What plans do you offer?",
          answer: `We have two simple plans: ${essentialPlanName} ($${essentialPriceMonthly.toFixed(2)} per month or $${essentialPriceYearly.toFixed(2)} per year) and ${proPlanName} ($${proPriceMonthly.toFixed(2)} per month or $${proPriceYearly.toFixed(2)} per year). Both plans come with a 30-day free trial so you can try them risk-free. The ${essentialPlanName} plan lets you track up to 500 transactions per month and connect up to 10 accounts. The ${proPlanName} plan gives you unlimited transactions and accounts.`,
        },
        {
          question: "Can I try it for free?",
          answer: `Yes! Both plans come with a 30-day free trial. That means you can use all the features for a full month without paying anything. If you decide it's not for you, just cancel before the trial ends and you won't be charged. If you love it, your subscription will start automatically after 30 days.`,
        },
        {
          question: "What happens after my free trial ends?",
          answer: "If you don't cancel, your subscription will start automatically and you'll be charged for the plan you chose. Don't worry—you can cancel anytime! If you cancel, you'll still have access until the end of the period you already paid for. No surprises!",
        },
        {
          question: `What do I get with the ${essentialPlanName} plan?`,
          answer: `The ${essentialPlanName} plan includes everything you need: track your investments, see detailed reports, import and export your data, connect your bank account automatically, and get smart category suggestions. You can track up to 500 transactions per month and connect up to 10 accounts.`,
        },
        {
          question: `What's the difference between ${essentialPlanName} and ${proPlanName}?`,
          answer: `The ${proPlanName} plan has everything the ${essentialPlanName} plan has, but with no limits! You can track unlimited transactions and connect unlimited accounts. It's perfect if you have lots of transactions or multiple bank accounts to manage.`,
        },
        {
          question: "Can I switch plans later?",
          answer: "Yes! You can upgrade or downgrade your plan anytime from your account settings. If you upgrade, you get the new features right away. If you downgrade, the change happens at the end of your current billing period. You're always in control!",
        },
        {
          question: "Do you offer a discount if I pay yearly?",
          answer: `Yes! Save 17% when you pay for a full year upfront. The ${essentialPlanName} plan is $${essentialPriceYearly.toFixed(2)} per year (that's only $${(essentialPriceYearly / 12).toFixed(2)} per month), and the ${proPlanName} plan is $${proPriceYearly.toFixed(2)} per year (that's only $${(proPriceYearly / 12).toFixed(2)} per month).`,
        },
        {
          question: "Can I cancel anytime?",
          answer: "Yes! You can cancel your subscription anytime from your account settings. When you cancel, you'll still have access until the end of the period you've already paid for. After that, you won't be charged again. It's that simple!",
        },
        {
          question: "Can I change my plan after I subscribe?",
          answer: "Absolutely! You can upgrade or downgrade anytime from your account settings. Upgrades take effect immediately so you can start using new features right away. Downgrades happen at the end of your current billing period. You can also switch between monthly and yearly billing anytime.",
        },
      ],
    },
    {
      title: "Features",
      questions: [
        {
          question: "How do I connect my bank account?",
          answer: `It's super easy! We use a secure service called Plaid (the same one used by thousands of other financial apps). When you connect your bank, you'll log in through Plaid's secure system. We never see or store your bank password—Plaid handles all that securely. Once connected, your transactions and account balances will automatically sync to Spare Finance. This feature is available on both ${essentialPlanName} and ${proPlanName} plans.`,
        },
        {
          question: "Is it safe to connect my bank account?",
          answer: "Yes, it's very safe! We use Plaid, which is trusted by banks and uses the same security as your bank does. We never see your bank password, username, or security questions. Plaid handles all the secure login stuff, and we only get your account information, transactions, and balances. You can disconnect your bank account anytime if you want to stop syncing.",
        },
        {
          question: "Can I import my transactions from a file?",
          answer: `Yes! If you have your transactions in a CSV file (like from Excel or another app), you can import them on ${essentialPlanName} and ${proPlanName} plans. The app will help you match up the columns in your file (like date, amount, description) with the right fields. You can even preview everything before importing to make sure it looks right!`,
        },
        {
          question: "Can I download my data?",
          answer: `Yes! On ${essentialPlanName} and ${proPlanName} plans, you can export all your transactions as a CSV file anytime. This is great for keeping a backup, using your data in other tools, or for tax time. You can export everything or just filter what you need.`,
        },
        {
          question: "How do budgets work?",
          answer: "Budgets are super simple! You set a spending limit for each category (like groceries or entertainment) for the month. The app tracks how much you've spent and shows you with a progress bar. Green means you're doing great (under 90% of your budget), yellow means you're getting close (90-100%), and red means you've gone over. It's an easy way to stay on track!",
        },
        {
          question: "Can I track my investments?",
          answer: `Yes! On ${essentialPlanName} and ${proPlanName} plans, you can track all your investments. You can add different types of investment accounts (like TFSA, RRSP, crypto wallets, etc.), add your stocks, ETFs, crypto, bonds, and other investments, record when you buy or sell, and see how much your portfolio is worth. The app even calculates your average cost automatically!`,
        },
        {
          question: "How do savings goals work?",
          answer: "It's easy! Just tell the app how much you want to save and when you want to reach your goal. The app will figure out how much you need to save each month and show you when you'll reach your goal. You can see your progress anytime, which helps you stay motivated!",
        },
        {
          question: "Can my family use the same account?",
          answer: `Yes! On the ${proPlanName} plan, you can invite family members to your account. Each person gets their own separate finances (their own transactions, accounts, budgets), but you as the account owner can see everyone's info to help manage things. It's perfect for couples or families who want to track their money separately but stay organized together.`,
        },
        {
          question: "Can family members see each other's finances?",
          answer: "No, they can't! Each family member has their own private financial data—their own transactions, accounts, budgets, goals, and investments. The account owner can see everyone's info to help manage things, but family members can't see each other's data. Your privacy is protected!",
        },
        {
          question: "How does the app know which category to use?",
          answer: "The app is smart! It learns from how you've categorized transactions before. It looks at your past transactions (up to 12 months) and learns your patterns. When you add a new transaction or import bank data, it suggests the most likely category. You can just click to accept it or change it if it's wrong. The more you use it, the smarter it gets!",
        },
        {
          question: "Can I disconnect my bank account?",
          answer: "Yes, anytime! Just go to your account settings and disconnect your bank. When you disconnect, we'll stop syncing new transactions, but all your old transactions will stay in your account. You can always reconnect later if you want!",
        },
        {
          question: "How do I add or remove family members?",
          answer: `On the ${proPlanName} plan, go to the 'Members' section in your account settings. You can invite family members by email—they'll get an invitation and can choose to join. As the account owner, you can see and manage everyone, and you can remove members anytime if needed.`,
        },
      ],
    },
    {
      title: "Account and Support",
      questions: [
        {
          question: "How do I sign up?",
          answer: "It's free and easy! Just click 'Get Started' on the homepage. You'll need to provide your email address and create a password, then confirm your email. That's it! No credit card needed to get started.",
        },
        {
          question: "I forgot my password. What do I do?",
          answer: "No problem! On the login page, click 'Forgot my password' and enter your email address. We'll send you a link to reset your password. Make sure to check your inbox and spam folder—sometimes the email ends up there!",
        },
        {
          question: "How do I update my payment method?",
          answer: "Easy! Go to your account settings and click on 'Billing'. From there, you can update your payment information anytime. We use Stripe (a trusted payment processor) to keep your payment info secure.",
        },
        {
          question: "Is my information private?",
          answer: "Yes, absolutely! Your financial data belongs to you and only you. We use advanced security to make sure only you (and any family members you invite) can see your data. We never sell or share your information with anyone. Your privacy is our priority!",
        },
        {
          question: "How do I get help if I have questions?",
          answer: "We're here to help! You can email us at support@sparefinance.com anytime, or visit the 'Help & Support' section in the app after you sign in. Our team will get back to you and help with whatever you need!",
        },
        {
          question: "Do you offer support in other languages?",
          answer: "Yes! Spare Finance is available in multiple languages, and our support team can help you in various languages too. Just let us know your preferred language and we'll do our best to help!",
        },
        {
          question: "What happens if I delete my account?",
          answer: (
            <>
              If you delete your account, all your data will be permanently deleted from our system within 30 days, as explained in our{" "}
              <Link 
                href="/privacy-policy" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:underline"
              >
                Privacy Policy
              </Link>
              . This can't be undone, so make sure to export your data first if you want to keep a copy!
            </>
          ),
        },
      ],
    },
    {
      title: "Technical and Compatibility",
      questions: [
        {
          question: "What devices can I use?",
          answer: "You can use Spare Finance on almost any device! It works on your computer, tablet, or smartphone—anything with a web browser. No need to download an app—just open your browser and go to the website. It works great on all screen sizes!",
        },
        {
          question: "Which web browsers work?",
          answer: "Spare Finance works on all popular browsers like Chrome, Firefox, Safari, Edge, and Opera. For the best experience, make sure you're using the latest version of your browser. It's free to update!",
        },
        {
          question: "Can I use it without internet?",
          answer: "Right now, you need an internet connection to use Spare Finance. But we're working on adding offline features so you can view and edit your transactions even when you're not connected. Stay tuned!",
        },
        {
          question: "Where is my data stored?",
          answer: "Your data is stored securely in the cloud (online servers). This means you can access it from any device, anywhere. It's also automatically backed up, so you don't have to worry about losing your information. We use secure, trusted systems to keep everything safe.",
        },
      ],
    },
  ], [essentialPlanName, proPlanName, essentialPriceMonthly, essentialPriceYearly, proPriceMonthly, proPriceYearly]);

  // Filter FAQ based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return faqCategories;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return faqCategories
      .map(category => {
        const filteredQuestions = category.questions.filter(faq => {
          const questionMatch = faq.question.toLowerCase().includes(query);
          const answerText = typeof faq.answer === 'string' 
            ? faq.answer.toLowerCase() 
            : faq.answer?.toString().toLowerCase() || '';
          const answerMatch = answerText.includes(query);
          return questionMatch || answerMatch;
        });

        if (filteredQuestions.length === 0) {
          return null;
        }

        return {
          ...category,
          questions: filteredQuestions,
        };
      })
      .filter((category): category is typeof faqCategories[0] => category !== null);
  }, [searchQuery, faqCategories]);

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
          <div className="flex items-center justify-between h-14 sm:h-16 md:h-18">
            <Link href="/" className="flex items-center">
              <div className="w-[120px] h-[32px] sm:w-[140px] sm:h-[36px] md:w-[150px] md:h-[40px] flex items-center">
                <Logo 
                  variant="wordmark" 
                  color="auto" 
                  width={150} 
                  height={40}
                />
              </div>
            </Link>
            <Button
              variant="ghost"
              size="small"
              asChild
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
            >
              <Link href="/">
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Back to Home</span>
                <span className="xs:hidden">Back</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 md:space-y-10 lg:space-y-12">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 md:mb-10">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <HelpCircle className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
              <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold">
                Frequently Asked Questions
              </h1>
            </div>
            <p className="text-xs xs:text-sm sm:text-base md:text-lg text-muted-foreground mb-4 sm:mb-6 px-2">
              Find answers to the most common questions about Spare Finance
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative px-2 sm:px-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for questions or answers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 sm:pl-10 pr-9 sm:pr-10 h-10 sm:h-12 text-sm sm:text-base"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="small"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                )}
              </div>
              {searchQuery && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-left">
                  {filteredCategories.reduce((acc, cat) => acc + cat.questions.length, 0)} result(s) found
                </p>
              )}
            </div>
          </div>

          {/* FAQ Categories */}
          {filteredCategories.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="py-8 sm:py-10 md:py-12 text-center px-4 sm:px-6">
                <p className="text-sm sm:text-base text-muted-foreground">
                  No results found for "{searchQuery}". Try different keywords or{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm sm:text-base"
                    onClick={() => setSearchQuery("")}
                  >
                    clear your search
                  </Button>
                  .
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-3 sm:space-y-4 md:space-y-5">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 md:mb-5">{category.title}</h2>
              <Accordion type="single" collapsible className="w-full space-y-2 sm:space-y-3">
                {category.questions.map((faq, faqIndex) => {
                  const itemId = `${categoryIndex}-${faqIndex}`;
                  return (
                    <AccordionItem key={faqIndex} value={itemId}>
                      <AccordionTrigger className="text-left text-sm sm:text-base md:text-lg font-medium pr-4 sm:pr-6">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 sm:pt-3">
                        {typeof faq.answer === 'string' ? (
                          <p className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed pr-4 sm:pr-6">
                            {faq.answer}
                          </p>
                        ) : (
                          <div className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed pr-4 sm:pr-6">
                            {faq.answer}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ))
          )}

          {/* Still have questions */}
          <Card className="bg-muted/50">
            <CardHeader className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <CardTitle className="text-lg sm:text-xl md:text-2xl">Still have questions?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 md:space-y-5 px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                Didn't find the answer you were looking for? Our support team is ready to help!
              </p>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm md:text-base">
                <p>
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:support@sparefinance.com"
                    className="text-primary hover:underline break-all"
                  >
                    support@sparefinance.com
                  </a>
                </p>
                <p className="text-muted-foreground">
                  For additional help, you can also visit the Help & Support page after signing in to your account.
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

