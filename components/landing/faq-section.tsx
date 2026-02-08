"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    q: "What is Spare Finance?",
    a: "Spare Finance is a simple app that helps you manage all your money in one place. You can track spending, set budgets, save for goals, and see where your money goes.",
  },
  {
    q: "How does it work?",
    a: "You can connect your bank or add transactions manually. The app sorts your spending into categories, helps you create budgets, and shows your financial health with the Spare Score.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. We use bank-level encryption and never sell your information. Your data is private and in your control.",
  },
  {
    q: "What's the free trial?",
    a: "You get a 30-day free trial with full access. No credit card required. Cancel anytime.",
  },
  {
    q: "What's included?",
    a: "Unlimited transactions and accounts, dashboard, Spare Score, budgets, goals, reports, receipts, and household sharing. Everything in one plan.",
  },
];

export function FAQSection() {
  const { ref, inView } = useInView();

  return (
    <section id="faq" ref={ref} className={cn("py-16 md:py-24 scroll-mt-20 transition-all duration-700", inView ? "opacity-100" : "opacity-0")}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Your questions, answered.</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Quick answers to common questions.
          </p>
        </div>
        <Accordion type="single" defaultValue="faq-0" collapsible className="mt-8 space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left data-[state=open]:text-primary">
                {item.q}
              </AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-sm text-muted-foreground">
          More questions?{" "}
          <Link href="/faq" className="text-primary hover:underline">
            See full FAQ
          </Link>
        </p>
      </div>
    </section>
  );
}
