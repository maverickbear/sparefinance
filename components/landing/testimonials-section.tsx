"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

export function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Finally, a finance app that actually saves me time. The bank integration is a game-changer—no more manual entry!",
      author: "Sarah Johnson",
      role: "Small Business Owner",
      avatar: "SJ",
    },
    {
      quote: "I've tried Mint, YNAB, and PocketGuard. Spare Finance is the only one that does everything I need without the complexity.",
      author: "Michael Chen",
      role: "Software Engineer",
      avatar: "MC",
    },
    {
      quote: "The AI categorization is incredible. It learned my spending patterns in weeks and now categorizes 90% of my transactions automatically.",
      author: "Emily Davis",
      role: "Marketing Director",
      avatar: "ED",
    },
    {
      quote: "As a family, we love the household members feature. We can track our finances together while keeping our individual accounts separate.",
      author: "David Wilson",
      role: "Financial Advisor",
      avatar: "DW",
    },
    {
      quote: "The savings goals feature helped me save $5,000 for my vacation. The progress tracking kept me motivated every month.",
      author: "Matthew Lewis",
      role: "Entrepreneur",
      avatar: "ML",
    },
    {
      quote: "Best $7.99 I spend every month. The investment tracking alone is worth it, but the whole package is incredible value.",
      author: "Robert Taylor",
      role: "Consultant",
      avatar: "RT",
    },
  ];

  return (
    <section id="testimonials" className="py-20 md:py-32 bg-muted/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Loved by Thousands of Users
          </h2>
          <p className="text-lg text-muted-foreground">
            See what real users are saying about how Spare Finance transformed their financial management
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <Quote className="w-8 h-8 text-primary mb-4 opacity-50" />
                <p className="text-base mb-4 font-medium">{testimonial.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

