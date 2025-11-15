"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

export type LogoVariant = "icon" | "wordmark" | "full";
export type LogoColor = "purple" | "white" | "auto";

interface LogoProps {
  variant?: LogoVariant;
  color?: LogoColor;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  showText?: boolean; // For icon variant, optionally show text next to it
}

/**
 * Logo component for Spare Finance
 * 
 * Variants:
 * - icon: Just the "S" icon (for collapsed nav, small spaces)
 * - wordmark: "SPARE FINANCE" text logo
 * - full: Full logo with icon and text (default)
 * 
 * Colors:
 * - purple: Purple logo on white background
 * - white: White logo on dark/purple background
 * - auto: Automatically chooses based on theme (defaults to purple)
 */
export function Logo({
  variant = "full",
  color = "auto",
  className,
  width,
  height,
  priority = false,
  showText = false,
}: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();

  // Track when component has mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine which logo to use based on variant and color
  const getLogoPath = () => {
    // Auto mode: detect dark mode and use white logo
    let effectiveColor = color;
    if (color === "auto") {
      // During SSR/initial render, default to purple to match server
      // After mount, use theme to determine color
      if (!mounted) {
        effectiveColor = "purple";
      } else {
        // Use resolvedTheme to handle system theme preference
        const isDark = resolvedTheme === "dark" || theme === "dark";
        effectiveColor = isDark ? "white" : "purple";
      }
    }

    if (variant === "icon") {
      // Icon variant - S icon
      return effectiveColor === "white"
        ? "/assets/logos/icon-white.svg" // White S on purple background
        : "/assets/logos/icon-purple.svg"; // Purple S on white background
    }

    if (variant === "wordmark") {
      // Wordmark variant - SPARE FINANCE text
      return effectiveColor === "white"
        ? "/assets/logos/wordmark-white.svg" // White text on dark background
        : "/assets/logos/wordmark-purple.svg"; // Purple/blue text on light background
    }

    // Full variant - icon + wordmark (or just wordmark if full not available)
    return effectiveColor === "white"
      ? "/assets/logos/wordmark-white.svg" // Fallback to wordmark if full not available
      : "/assets/logos/wordmark-purple.svg";
  };

  // Default dimensions based on variant
  const defaultDimensions = {
    icon: { width: 40, height: 40 },
    wordmark: { width: 150, height: 40 },
    full: { width: 180, height: 40 },
  };

  const finalWidth = width ?? defaultDimensions[variant].width;
  const finalHeight = height ?? defaultDimensions[variant].height;

  // Determine effective color for fallback
  let effectiveColorForFallback = color;
  if (color === "auto") {
    // During SSR/initial render, default to purple to match server
    if (!mounted) {
      effectiveColorForFallback = "purple";
    } else {
      const isDark = resolvedTheme === "dark" || theme === "dark";
      effectiveColorForFallback = isDark ? "white" : "purple";
    }
  }

  // Fallback: show text if image fails to load
  if (imgError && variant === "icon") {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg",
          effectiveColorForFallback === "white"
            ? "bg-purple-600 text-white"
            : "bg-purple-100 text-purple-600",
          className
        )}
        style={{ width: finalWidth, height: finalHeight }}
      >
        <span className="text-xl font-bold">S</span>
      </div>
    );
  }

  return (
    <div className={cn("relative flex-shrink-0 flex items-center gap-2", className)}>
      <div 
        className="relative"
        style={{ width: finalWidth, height: finalHeight }}
      >
        <Image
          src={getLogoPath()}
          alt="Spare Finance"
          width={finalWidth}
          height={finalHeight}
          priority={priority}
          className="object-contain"
          style={{ width: "100%", height: "100%" }}
          onError={() => setImgError(true)}
        />
      </div>
      {showText && variant === "icon" && (
        <span className="text-xl font-bold">Spare Finance</span>
      )}
    </div>
  );
}

/**
 * Auto Logo component that adapts to theme
 * Uses white variant in dark mode, purple in light mode
 */
export function AutoLogo({
  variant = "full",
  className,
  width,
  height,
  priority = false,
  showText = false,
}: Omit<LogoProps, "color">) {
  return (
    <Logo
      variant={variant}
      color="auto"
      className={className}
      width={width}
      height={height}
      priority={priority}
      showText={showText}
    />
  );
}

