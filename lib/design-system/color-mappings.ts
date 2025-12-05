/**
 * Color Mapping Reference
 * 
 * This file serves as documentation and reference for migration.
 * DO NOT use this for runtime class conversion.
 * Use these mappings as reference when manually migrating code.
 * 
 * For codemods and scripts, use this as the source of truth.
 * 
 * IMPORTANT: This is a lookup table, not a runtime conversion utility.
 * Do not create functions that convert classes at runtime.
 */

export const colorMappings = {
  // Background colors
  'bg-red-500': 'bg-sentiment-negative',
  'bg-red-600': 'bg-sentiment-negative',
  'bg-red-400': 'bg-sentiment-negative',
  'bg-yellow-500': 'bg-sentiment-warning',
  'bg-yellow-600': 'bg-sentiment-warning',
  'bg-yellow-400': 'bg-sentiment-warning',
  'bg-green-500': 'bg-sentiment-positive',
  'bg-green-600': 'bg-sentiment-positive',
  'bg-green-400': 'bg-sentiment-positive',
  'bg-green-100': 'bg-sentiment-positive/10',
  'bg-green-200': 'bg-sentiment-positive/20',
  'bg-blue-500': 'bg-interactive-primary',
  'bg-blue-600': 'bg-interactive-primary',
  'bg-blue-400': 'bg-interactive-primary',
  
  // Text colors
  'text-red-500': 'text-sentiment-negative',
  'text-red-600': 'text-sentiment-negative',
  'text-red-400': 'text-sentiment-negative',
  'text-yellow-500': 'text-sentiment-warning',
  'text-yellow-600': 'text-sentiment-warning',
  'text-yellow-400': 'text-sentiment-warning',
  'text-green-500': 'text-sentiment-positive',
  'text-green-600': 'text-sentiment-positive',
  'text-green-800': 'text-sentiment-positive',
  'text-green-400': 'text-sentiment-positive',
  'text-blue-500': 'text-interactive-primary',
  'text-blue-600': 'text-interactive-primary',
  
  // Border colors
  'border-red-500': 'border-sentiment-negative',
  'border-red-600': 'border-sentiment-negative',
  'border-yellow-500': 'border-sentiment-warning',
  'border-yellow-600': 'border-sentiment-warning',
  'border-green-500': 'border-sentiment-positive',
  'border-green-600': 'border-sentiment-positive',
  'border-blue-500': 'border-interactive-primary',
  'border-blue-600': 'border-interactive-primary',
  
  // Ring colors
  'ring-red-500': 'ring-sentiment-negative',
  'ring-red-600': 'ring-sentiment-negative',
  'ring-yellow-500': 'ring-sentiment-warning',
  'ring-yellow-600': 'ring-sentiment-warning',
  'ring-green-500': 'ring-sentiment-positive',
  'ring-green-600': 'ring-sentiment-positive',
  'ring-blue-500': 'ring-interactive-primary',
  'ring-blue-600': 'ring-interactive-primary',
  
  // Hover states
  'hover:bg-red-500': 'hover:bg-sentiment-negative',
  'hover:bg-red-600': 'hover:bg-sentiment-negative',
  'hover:bg-yellow-500': 'hover:bg-sentiment-warning',
  'hover:bg-yellow-600': 'hover:bg-sentiment-warning',
  'hover:bg-green-500': 'hover:bg-sentiment-positive',
  'hover:bg-green-600': 'hover:bg-sentiment-positive',
  'hover:bg-blue-500': 'hover:bg-interactive-primary',
  'hover:bg-blue-600': 'hover:bg-interactive-primary',
  'hover:text-red-500': 'hover:text-sentiment-negative',
  'hover:text-yellow-500': 'hover:text-sentiment-warning',
  'hover:text-green-500': 'hover:text-sentiment-positive',
  'hover:text-blue-500': 'hover:text-interactive-primary',
  'hover:border-red-500': 'hover:border-sentiment-negative',
  'hover:border-yellow-500': 'hover:border-sentiment-warning',
  'hover:border-green-500': 'hover:border-sentiment-positive',
  
  // Focus states
  'focus:bg-red-500': 'focus:bg-sentiment-negative',
  'focus:bg-yellow-500': 'focus:bg-sentiment-warning',
  'focus:bg-green-500': 'focus:bg-sentiment-positive',
  'focus:ring-red-500': 'focus:ring-sentiment-negative',
  'focus:ring-yellow-500': 'focus:ring-sentiment-warning',
  'focus:ring-green-500': 'focus:ring-sentiment-positive',
  'focus-visible:ring-red-500': 'focus-visible:ring-sentiment-negative',
  'focus-visible:ring-yellow-500': 'focus-visible:ring-sentiment-warning',
  'focus-visible:ring-green-500': 'focus-visible:ring-sentiment-positive',
  'focus-visible:ring-blue-500': 'focus-visible:ring-interactive-primary',
  
  // Active/Selected states
  'active:bg-red-500': 'active:bg-sentiment-negative',
  'active:bg-yellow-500': 'active:bg-sentiment-warning',
  'active:bg-green-500': 'active:bg-sentiment-positive',
  'data-[state=active]:bg-red-500': 'data-[state=active]:bg-sentiment-negative',
  'data-[state=active]:bg-yellow-500': 'data-[state=active]:bg-sentiment-warning',
  'data-[state=active]:bg-green-500': 'data-[state=active]:bg-sentiment-positive',
  'data-[state=selected]:bg-red-500': 'data-[state=selected]:bg-sentiment-negative',
  'data-[state=selected]:bg-yellow-500': 'data-[state=selected]:bg-sentiment-warning',
  'data-[state=selected]:bg-green-500': 'data-[state=selected]:bg-sentiment-positive',
  
  // Disabled states
  'disabled:bg-red-500': 'disabled:bg-sentiment-negative',
  'disabled:bg-yellow-500': 'disabled:bg-sentiment-warning',
  'disabled:bg-green-500': 'disabled:bg-sentiment-positive',
  'disabled:text-red-500': 'disabled:text-sentiment-negative',
  'disabled:text-yellow-500': 'disabled:text-sentiment-warning',
  'disabled:text-green-500': 'disabled:text-sentiment-positive',
  
  // Opacity variants
  'bg-red-500/10': 'bg-sentiment-negative/10',
  'bg-red-500/20': 'bg-sentiment-negative/20',
  'bg-yellow-500/10': 'bg-sentiment-warning/10',
  'bg-yellow-500/20': 'bg-sentiment-warning/20',
  'bg-green-500/10': 'bg-sentiment-positive/10',
  'bg-green-500/20': 'bg-sentiment-positive/20',
  'bg-blue-500/10': 'bg-interactive-primary/10',
  'bg-blue-500/20': 'bg-interactive-primary/20',
  
  // Dark mode variants (if used)
  'dark:bg-red-500': 'dark:bg-sentiment-negative',
  'dark:bg-yellow-500': 'dark:bg-sentiment-warning',
  'dark:bg-green-500': 'dark:bg-sentiment-positive',
  'dark:text-red-500': 'dark:text-sentiment-negative',
  'dark:text-yellow-500': 'dark:text-sentiment-warning',
  'dark:text-green-500': 'dark:text-sentiment-positive',
} as const;

/**
 * Type for color mapping keys
 */
export type ColorMappingKey = keyof typeof colorMappings;

/**
 * Type for color mapping values
 */
export type ColorMappingValue = typeof colorMappings[ColorMappingKey];

