"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Finally, a finance app that actually saves me time. The bank integration is a game-changer—no more manual entry!",
      author: "Sarah Johnson",
      role: "Small Business Owner",
      rating: 5,
    },
    {
      quote: "I've tried Mint, YNAB, and PocketGuard. Spare Finance is the only one that does everything I need without the complexity.",
      author: "Michael Chen",
      role: "Software Engineer",
      rating: 5,
    },
    {
      quote: "The AI categorization is incredible. It learned my spending patterns in weeks and now categorizes 90% of my transactions automatically.",
      author: "Emily Davis",
      role: "Marketing Director",
      rating: 5,
    },
    {
      quote: "As a family, we love the household members feature. We can track our finances together while keeping our individual accounts separate.",
      author: "David Wilson",
      role: "Financial Advisor",
      rating: 5,
    },
    {
      quote: "The savings goals feature helped me save $5,000 for my vacation. The progress tracking kept me motivated every month.",
      author: "Matthew Lewis",
      role: "Entrepreneur",
      rating: 5,
    },
    {
      quote: "Best $7.99 I spend every month. The investment tracking alone is worth it, but the whole package is incredible value.",
      author: "Robert Taylor",
      role: "Consultant",
      rating: 5,
    },
  ];

  // Duplicate testimonials for seamless infinite scroll
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section id="testimonials" className="py-20 md:py-32 bg-background overflow-hidden">
      {/* Header */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-16 md:mb-24">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl sm:text-6xl md:text-7xl font-semibold mb-6 tracking-tight">
            Loved by Thousands of Users
          </h2>
          <p className="text-xl sm:text-2xl text-muted-foreground font-light">
            See what real users are saying about how Spare Finance transformed their financial management
          </p>
        </div>
      </div>

      {/* Infinite Carousel - Full Width with Fade */}
      <div className="relative w-full overflow-hidden">
        {/* Left Fade */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        
        {/* Right Fade */}
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
        {/* Carousel */}
        <div className="animate-scroll-infinite flex">
          {duplicatedTestimonials.map((testimonial, index) => (
            <div
              key={index}
              className="flex-shrink-0 px-4"
              style={{ width: "320px" }}
            >
              <div className="bg-muted/30 rounded-2xl p-6 md:p-8 h-full border border-border/50">
                {/* Star Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-4 w-4",
                        star <= testimonial.rating
                          ? "text-yellow-400 fill-current"
                          : "text-muted-foreground"
                      )}
                    />
                  ))}
                </div>
                <p className="text-base md:text-lg mb-6 font-light leading-relaxed text-foreground">
                  {testimonial.quote}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium text-base">
                      {testimonial.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-base">{testimonial.author}</p>
                    <p className="text-base text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
