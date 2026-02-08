"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingImage } from "./landing-image";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

export interface FeatureSpotlightProps {
  image: string;
  imageAlt: string;
  title: string;
  tagline: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  /** When true, image is on the right (alternating layout) */
  reverse?: boolean;
}

export function FeatureSpotlightSection({
  image,
  imageAlt,
  title,
  tagline,
  description,
  ctaText = "Start free trial",
  ctaHref = "/auth/signup",
  reverse = false,
}: FeatureSpotlightProps) {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={cn(
        "py-16 md:py-24 transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className={cn("relative w-full", reverse && "lg:order-2")}>
            <div className="relative aspect-[4/3] max-w-lg mx-auto rounded-[32px] bg-[#f8f4f1] overflow-hidden">
              <LandingImage
                src={image}
                alt={imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
          <div className={cn("flex flex-col justify-center", reverse && "lg:order-1")}>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              {title}
            </h2>
            <p className="mt-2 text-lg text-muted-foreground">{tagline}</p>
            <p className="mt-4 text-muted-foreground leading-relaxed">{description}</p>
            {ctaHref && (
              <Button
                asChild
                size="large"
                className="mt-8 w-fit bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link href={ctaHref}>{ctaText}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
