/**
 * Centralized Color System
 * 
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * This file is generated from spareds/tokens/colors/default-values.json
 * Run 'npm run sync:colors' to update this file.
 * 
 * This is the single source of truth for all colors in the application.
 * All colors should be imported from this file instead of being hardcoded.
 * 
 * Colors are organized according to the simplified design system:
 * - Content: Text and content colors
 * - Interactive: Interactive element colors
 * - Background: Background colors
 * - Border: Border colors
 * - Base: Base utility colors
 * - Sentiment: Sentiment colors (positive, negative, warning)
 */

/**
 * Content Colors - For text and content
 */
export const content = {
    // Use to emphasise primary content in relation to other elements nearby
    primary: "#0E0F0C",
    // Use for most body text, and in supportive elements that give context to content that's close to it
    secondary: "#454745",
    // Use in form inputs for placeholders, and for the label that says a field is 'Optional'. Avoid using elsewhere
    tertiary: "#6A6C6A",
    // Use for links and for external link icons that appear in line with link text
    link: "#357B00",
} as const;

/**
 * Interactive Colors - For interactive elements
 */
export const interactive = {
    // For neutral interactive elements or emphasising active items in a list
    primary: "#94DD78",
    // For sparing use as an accent colour in interactive elements, such as primary button backgrounds
    accent: "#B5EF90",
    // For de-emphasised interactivity, like borders on inputs and checkboxes, and clear buttons on search inputs. Do not use on text
    secondary: "#ECEEEA",
    // For text and icons on a Bright Green Interactive Accent surface, ensuring visibility in dark mode, and also for surfaces if needed
    control: "#163300",
    // For text and icons on a Forest Green Interactive Primary surface, ensuring visibility in dark mode
    contrast: "#9FE870",
} as const;

/**
 * Background Colors - For larger surface areas
 */
export const background = {
    // The lowest level background used in most screens
    screen: "#FFFFFF",
    // Use for elevated surfaces that partially show the content behind it, like bottom sheets and sidebars
    elevated: "#FFFFFF",
    // Use for delineating areas without using borders, like neutral alerts and avatars
    neutral: "#16330014",
    // Use for faintly darkening an area, for example on loading shimmers
    overlay: "#16330014",
} as const;

/**
 * Border Colors - To subtly separate different blocks of content
 */
export const border = {
    // Use in most separators, for example in the section header and tabs components
    neutral: "#0E0F0C1F",
    // Use on the edges of images to differentiate them from the background, such as flags in avatars
    overlay: "#0E0F0C1F",
} as const;

/**
 * Base Colors - Useful colors for several different scenarios
 */
export const base = {
    // Use for copy on negative buttons. Turns dark on dark mode to keep elements visible
    contrast: "#FFFFFF",
    // Use in informational or interactive elements where white is needed, or where other colours would be too prominent in the hierarchy
    light: "#FFFFFF",
    // Use in informational or interactive elements where a dark colour is needed
    dark: "#181818",
} as const;

/**
 * Sentiment Colors - To indicate positive, negative, or warning
 */
export const sentiment = {
    // Indicates negative sentiment, for example on error states or destructive actions. Can be used as text or as a background
    negative: "#A8200D",
    // Indicates positive sentiment, for example in positive alerts. Can be used as text or as a background
    positive: "#2F5711",
    // Indicates warning sentiment, for example on alerts. Should only be used as a background colour and is not accessible as text
    warning: "#EDC843",
} as const;

/**
 * Helper function to convert hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle hex with alpha (8 digits)
  if (hex.length === 9) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }
  
  // Handle regular hex (6 digits)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Helper function to convert hex to HSL (for Tailwind CSS variables)
 * Returns format: "h s% l%" (without hsl() wrapper)
 */
export function hexToHsl(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  
  // Normalize RGB values to 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);
  
  return `${h} ${s}% ${lPercent}%`;
}

/**
 * Helper function to get rgba string from hex color
 */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Extract alpha from hex color with alpha (8 digits)
 */
export function extractAlpha(hex: string): number | null {
  if (hex.length === 9) {
    const alpha = parseInt(hex.slice(7, 9), 16) / 255;
    return alpha;
  }
  return null;
}

/**
 * All colors exported as a single object for convenience
 */
export const colors = {
  content,
  interactive,
  background,
  border,
  base,
  sentiment,
} as const;

/**
 * Legacy color mappings for backward compatibility
 * These map old color names to new simplified colors
 */
export const legacy = {
  // Map old primary colors to new interactive colors
  primary: {
    900: interactive.control,
    800: interactive.control,
    700: interactive.control,
    600: interactive.primary,
    500: interactive.primary,
    400: interactive.accent,
    300: interactive.contrast,
  },
  // Map old neutral/grey colors to new content colors
  neutral: {
    50: background.screen,
    100: base.light,
    200: base.light,
    300: content.tertiary,
    400: content.secondary,
    500: content.primary,
    600: base.dark,
  },
  // Map old semantic colors to new sentiment colors
  semantic: {
    success: sentiment.positive,
    error: sentiment.negative,
    warning: sentiment.warning,
    info: interactive.primary,
  },
} as const;

/**
 * Type exports for TypeScript
 */
export type ContentColor = typeof content[keyof typeof content];
export type InteractiveColor = typeof interactive[keyof typeof interactive];
export type BackgroundColor = typeof background[keyof typeof background];
export type BorderColor = typeof border[keyof typeof border];
export type BaseColor = typeof base[keyof typeof base];
export type SentimentColor = typeof sentiment[keyof typeof sentiment];
