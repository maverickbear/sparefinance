"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ParallaxFeatureProps {
  title: string;
  description: string;
  imageUrl?: string;
  icon?: React.ReactNode;
  reverse?: boolean;
}

export function ParallaxFeature({
  title,
  description,
  imageUrl,
  icon,
  reverse = false,
}: ParallaxFeatureProps) {
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const elementTop = rect.top;
        const elementBottom = rect.bottom;
        
        // Check if element is in viewport
        const isInViewport = elementTop < windowHeight && elementBottom > 0;
        setIsVisible(isInViewport);

        if (isInViewport) {
          // Calculate scroll progress (0 to 1)
          const scrollProgress = Math.max(
            0,
            Math.min(1, (windowHeight - elementTop) / (windowHeight + rect.height))
          );
          setScrollY(scrollProgress);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const parallaxOffset = (scrollY - 0.5) * 200; // -100px to 100px

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-8 md:gap-12 py-12 md:py-20 transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-30"
      }`}
    >
      {/* Image/Visual Section */}
      <div
        className="flex-1 w-full md:w-1/2 relative"
        style={{
          transform: `translateY(${parallaxOffset * 0.8}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 aspect-video flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-8">
              {icon && <div className="mb-4 flex justify-center">{icon}</div>}
              <p className="text-muted-foreground text-sm">{title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div
        className="flex-1 w-full md:w-1/2"
        style={{
          transform: `translateY(${-parallaxOffset * 0.5}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <Card className="border-2 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-base md:text-lg">
              {description}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

