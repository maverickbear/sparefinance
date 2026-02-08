"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LandingImageProps {
  /** Filename in public/landing/ (e.g. "hero.jpg") */
  src: string;
  alt: string;
  className?: string;
  /** Use for responsive aspect ratio; image fills container */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  /** JPEG/WebP quality 1–100. Default 100 for full quality. */
  quality?: number;
}

/**
 * Renders an image from public/landing/. Shows a neutral placeholder if the image fails to load or is missing.
 */
export function LandingImage({
  src,
  alt,
  className,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  quality = 100,
}: LandingImageProps) {
  const [error, setError] = useState(false);
  const path = `/landing/${src}`;

  if (error) {
    return (
      <div
        className={cn(
          "bg-[#f8f4f1] flex items-center justify-center rounded-xl",
          className
        )}
        role="img"
        aria-label={alt}
      >
        <span className="text-xs text-muted-foreground px-4 text-center">
          Add {src} to public/landing/
        </span>
      </div>
    );
  }

  return (
    <Image
      src={path}
      alt={alt}
      className={cn("rounded-xl object-cover", className)}
      fill={fill}
      width={fill ? undefined : width ?? 800}
      height={fill ? undefined : height ?? 500}
      sizes={sizes ?? "(max-width: 1024px) 100vw, 600px"}
      priority={priority}
      quality={quality}
      onError={() => setError(true)}
    />
  );
}
