/**
 * Design System - Component Sizes
 * 
 * Centralized size definitions for all reusable components.
 * All components default to "medium" size for consistency.
 */

export const componentSizes = {
  // Button sizes
  button: {
    small: {
      height: "h-9",
      paddingX: "px-3",
      paddingY: "py-2",
      text: "text-sm",
      rounded: "rounded-[12px]",
    },
    medium: {
      height: "h-10",
      paddingX: "px-4",
      paddingY: "py-2",
      text: "text-sm",
      rounded: "rounded-[12px]",
    },
    large: {
      height: "h-11",
      paddingX: "px-8",
      paddingY: "py-2",
      text: "text-base",
      rounded: "rounded-[12px]",
    },
    icon: {
      height: "h-10",
      width: "w-10",
      paddingX: "",
      paddingY: "",
      text: "text-sm",
      rounded: "rounded-[12px]",
    },
  },
  
  // Input sizes
  input: {
    small: {
      height: "h-10",
      paddingX: "px-3",
      paddingY: "py-2",
      text: "text-sm",
      rounded: "rounded-[12px]",
    },
    medium: {
      height: "h-12",
      paddingX: "px-4",
      paddingY: "py-3",
      text: "text-base",
      rounded: "rounded-[12px]",
    },
    large: {
      height: "h-14",
      paddingX: "px-5",
      paddingY: "py-4",
      text: "text-lg",
      rounded: "rounded-[12px]",
    },
  },
  
  // Select sizes
  select: {
    small: {
      height: "h-10",
      paddingX: "px-3",
      paddingY: "py-2",
      text: "text-sm",
      rounded: "rounded-[12px]",
    },
    medium: {
      height: "h-12",
      paddingX: "px-4",
      paddingY: "py-3",
      text: "text-base",
      rounded: "rounded-[12px]",
    },
    large: {
      height: "h-14",
      paddingX: "px-5",
      paddingY: "py-4",
      text: "text-lg",
      rounded: "rounded-[12px]",
    },
  },
  
  // Badge sizes
  badge: {
    small: {
      paddingX: "px-1.5",
      paddingY: "py-0.5",
      text: "text-[10px]",
      rounded: "rounded-full",
    },
    medium: {
      paddingX: "px-2.5",
      paddingY: "py-0.5",
      text: "text-xs",
      rounded: "rounded-full",
    },
    large: {
      paddingX: "px-3",
      paddingY: "py-1",
      text: "text-sm",
      rounded: "rounded-full",
    },
  },
  
  // Textarea sizes
  textarea: {
    small: {
      minHeight: "min-h-[80px]",
      paddingX: "px-3",
      paddingY: "py-2",
      text: "text-sm",
      rounded: "rounded-[12px]",
    },
    medium: {
      minHeight: "min-h-[100px]",
      paddingX: "px-4",
      paddingY: "py-3",
      text: "text-base",
      rounded: "rounded-[12px]",
    },
    large: {
      minHeight: "min-h-[120px]",
      paddingX: "px-5",
      paddingY: "py-4",
      text: "text-lg",
      rounded: "rounded-[12px]",
    },
  },
} as const;

/**
 * Mobile spacing constants for consistent spacing across mobile UI
 * These follow iOS Human Interface Guidelines and Material Design recommendations
 */
export const mobileSpacing = {
  // Card padding - consistent across all mobile cards
  card: {
    padding: "p-4",
    paddingX: "px-4",
    paddingY: "py-4",
  },
  
  // Internal card spacing
  cardContent: {
    gap: "space-y-4",
    gapSmall: "space-y-3",
  },
  
  // Section spacing
  section: {
    gap: "gap-4",
    gapSmall: "gap-3",
    vertical: "space-y-4",
    verticalLarge: "space-y-6",
  },
  
  // Container padding
  container: {
    padding: "px-4",
    paddingSmall: "px-3",
    paddingLarge: "px-6",
  },
  
  // Page spacing
  page: {
    paddingTop: "pt-4",
    paddingBottom: "pb-4",
    vertical: "space-y-4",
    verticalLarge: "space-y-6",
  },
  
  // Touch target minimums (iOS HIG: 44x44pt minimum)
  touchTarget: {
    minHeight: "min-h-[44px]",
    minWidth: "min-w-[44px]",
  },
  
  // Icon sizes for mobile
  icon: {
    small: "h-4 w-4",
    medium: "h-5 w-5",
    large: "h-6 w-6",
  },
  
  // Bottom navigation
  bottomNav: {
    height: "h-16",
    padding: "px-2",
    gap: "gap-1",
  },
} as const;

/**
 * Default size for all components
 */
export const DEFAULT_SIZE = "medium" as const;

/**
 * Helper function to get size classes for a component
 */
export function getSizeClasses(
  component: keyof typeof componentSizes,
  size: "small" | "medium" | "large" | "icon" = DEFAULT_SIZE
): string {
  const componentSizesForComponent = componentSizes[component] as Record<string, Record<string, string>>;
  const sizeConfig = componentSizesForComponent[size];
  if (!sizeConfig) {
    // Fallback to medium if size doesn't exist
    const mediumConfig = componentSizesForComponent["medium"];
    return Object.values(mediumConfig).filter(Boolean).join(" ");
  }
  
  return Object.values(sizeConfig).filter(Boolean).join(" ");
}

/**
 * Type definitions for component sizes
 */
export type ComponentSize = "small" | "medium" | "large";
export type ButtonSize = ComponentSize | "icon";

