"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

export function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Seamless and user-friendly experience!",
      author: "David Wilson",
      role: "Financial Advisor",
      avatar: "DW",
    },
    {
      quote: "Best finance tool I've used!",
      author: "Matthew Lewis",
      role: "Entrepreneur",
      avatar: "ML",
    },
    {
      quote: "Transformed how I manage my finances.",
      author: "Sarah Johnson",
      role: "Business Owner",
      avatar: "SJ",
    },
    {
      quote: "Incredible insights into my spending habits.",
      author: "Michael Chen",
      role: "Software Engineer",
      avatar: "MC",
    },
    {
      quote: "Simple yet powerful. Exactly what I needed.",
      author: "Emily Davis",
      role: "Marketing Director",
      avatar: "ED",
    },
    {
      quote: "The best investment I've made for my financial health.",
      author: "Robert Taylor",
      role: "Consultant",
      avatar: "RT",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-muted/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Client testimonials
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover your ultimate finance management solution for individuals, startups, and enterprises
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

