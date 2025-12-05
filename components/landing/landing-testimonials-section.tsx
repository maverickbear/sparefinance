"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function LandingTestimonialsSection() {
  const testimonials = [
    {
      quote: "For the first time, we know exactly where our money goes. We can see we spend too much on takeout and now we're learning to cook more at home. Our Spare Score is improving!",
      author: "Maria & Carlos Silva",
      location: "Family of 4, Toronto",
      rating: 5,
    },
    {
      quote: "We set a savings goal for our kids' education and can see exactly when we'll reach it. It's motivating to see the progress together as a family every month.",
      author: "Jennifer & Mark Thompson",
      location: "Family of 3, Vancouver",
      rating: 5,
    },
    {
      quote: "I finally understand my spending. The insights showed me I was spending $400/month on subscriptions I barely use. Canceled half of them and now saving that money.",
      author: "David Chen",
      location: "Montreal, Canada",
      rating: 5,
    },
    {
      quote: "We're learning to budget together. My partner and I can see all our expenses in one place and make decisions together. It's changed how we talk about money.",
      author: "Sarah & James Wilson",
      location: "Couple, Calgary",
      rating: 5,
    },
    {
      quote: "The Spare Score helped me realize I was living paycheck to paycheck. Now I'm learning to save 20% of my income and it's actually working. My score went from 45 to 72!",
      author: "Roberto Martinez",
      location: "Ottawa, Canada",
      rating: 5,
    },
    {
      quote: "We track everything as a family now. The kids can see where money goes and we're teaching them about saving. It's become a family activity.",
      author: "The Johnson Family",
      location: "Family of 5, Edmonton",
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
            Families Learning<br />to Grow Together
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how families are organizing their finances, learning to save, and building wealth together
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
              className="flex-shrink-0 px-4 w-80"
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
                          ? "text-sentiment-warning fill-current"
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

