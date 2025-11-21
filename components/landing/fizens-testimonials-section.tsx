"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function FizensTestimonialsSection() {
  const testimonials = [
    {
      quote: "The AI categorization is incredible. It learned my spending patterns and now automatically categorizes 90% of my transactions. Saves me hours every month!",
      author: "Michael Brown",
      location: "Toronto, Canada",
      rating: 5,
    },
    {
      quote: "Spare Score helped me understand my financial health. I've improved my score from 65 to 85 by following the insights and setting better budgets.",
      author: "Sarah Jane",
      location: "Vancouver, Canada",
      rating: 5,
    },
    {
      quote: "As a Questrade user, being able to track my investments alongside my expenses in one dashboard is a game-changer. Everything in one place!",
      author: "David Lee",
      location: "Montreal, Canada",
      rating: 5,
    },
    {
      quote: "The savings goals feature with ETA calculations kept me motivated. I saved $10,000 for my vacation faster than I thought possible.",
      author: "Emily Smith",
      location: "Calgary, Canada",
      rating: 5,
    },
    {
      quote: "Household sharing is perfect for our family. We can see our collective finances while keeping individual accounts separate. Exactly what we needed.",
      author: "Sarah Johnson",
      location: "Ottawa, Canada",
      rating: 5,
    },
    {
      quote: "The debt management tools helped me create a payoff strategy. I've paid off $15K in credit card debt using the avalanche method they suggested.",
      author: "Guy Hawkins",
      location: "Edmonton, Canada",
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
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Testimonials
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Our Users<br />Talk About Us
          </h2>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-bold">4.8/5</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="w-5 h-5 text-yellow-400 fill-current"
                />
              ))}
            </div>
          </div>
          <p className="text-lg text-muted-foreground">
            Based on 14K+ reviews
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
              <div className="bg-card rounded-2xl p-6 md:p-8 h-full border border-border/50 hover:border-primary/20 transition-all">
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
                <p className="text-base md:text-lg mb-6 font-normal leading-relaxed text-foreground">
                  {testimonial.quote}
                </p>
                <div>
                  <p className="font-semibold text-base mb-1">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

