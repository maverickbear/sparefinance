#!/usr/bin/env tsx

/**
 * Color Synchronization Script
 * 
 * This script synchronizes colors from the design tokens
 * to all other places where colors are used:
 * - lib/design-system/colors.ts (TypeScript constants)
 * - app/globals.css (CSS variables in HSL format)
 * 
 * Usage: npm run sync:colors
 */

import * as fs from 'fs';
import * as path from 'path';

// Color mapping from design tokens to CSS variables
const CSS_VARIABLE_MAPPINGS: Record<string, string> = {
  // Content colors
  'content.primary': '--foreground',
  'content.secondary': '--muted-foreground',
  'content.tertiary': '--grey-300',
  'content.link': '--content-link',
  
  // Interactive colors
  'interactive.primary': '--primary',
  'interactive.accent': '--accent',
  'interactive.secondary': '--secondary',
  'interactive.control': '--primary-900',
  'interactive.contrast': '--primary-300',
  
  // Background colors
  'background.screen': '--background',
  'background.elevated': '--card',
  'background.neutral': '--muted',
  'background.overlay': '--muted',
  
  // Base colors
  'base.contrast': '--primary-foreground',
  'base.light': '--background',
  'base.dark': '--grey-600',
  
  // Sentiment colors
  'sentiment.negative': '--destructive',
  'sentiment.positive': '--sentiment-positive',
  'sentiment.warning': '--sentiment-warning',
  
  // Border colors
  'border.neutral': '--border',
  'border.overlay': '--input',
};

// Legacy mappings for primary scale
const PRIMARY_SCALE_MAPPINGS: Record<string, string> = {
  'interactive.control.dark': '--primary-900',
  'interactive.control.medium': '--primary-800',
  'interactive.control.light': '--primary-700',
  'interactive.primary.dark': '--primary-600',
  'interactive.primary.light': '--primary-500',
  'interactive.accent': '--primary-400',
  'interactive.contrast': '--primary-300',
};

// Legacy mappings for grey scale
const GREY_SCALE_MAPPINGS: Record<string, string> = {
  'background.screen': '--grey-50',
  'base.light.lighter': '--grey-100',
  'base.light.light': '--grey-200',
  'content.tertiary': '--grey-300',
  'content.secondary': '--grey-400',
  'content.primary.medium': '--grey-500',
  'base.dark.light': '--grey-600',
  'base.dark.medium': '--grey-700',
  'base.dark.dark': '--grey-800',
  'content.primary.dark': '--grey-900',
};

// Legacy mappings for neutral scale
const NEUTRAL_SCALE_MAPPINGS: Record<string, string> = {
  'background.screen': '--neutral-50',
  'base.light.lighter': '--neutral-100',
  'base.light.light': '--neutral-200',
  'content.tertiary': '--neutral-300',
  'content.secondary': '--neutral-400',
  'content.primary': '--neutral-500',
  'base.dark': '--neutral-600',
};

/**
 * Convert hex color to HSL format for CSS variables
 * Returns format: "h s% l%" (without hsl() wrapper)
 */
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Handle hex with alpha (8 digits)
  let r: number, g: number, b: number;
  
  if (hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  
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
 * Extract alpha from hex color with alpha (8 digits)
 */
function extractAlpha(hex: string): number | null {
  if (hex.length === 9) {
    const alpha = parseInt(hex.slice(7, 9), 16) / 255;
    return Math.round(alpha * 100) / 100;
  }
  return null;
}

/**
 * Flatten the nested color object structure
 */
function flattenColors(obj: any, prefix: string = '', result: Map<string, { value: string; description: string; rgb?: string; rgba?: string }> = new Map()): Map<string, { value: string; description: string; rgb?: string; rgba?: string }> {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && 'value' in value) {
      // This is a color definition
      const colorValue = value as { value: unknown; description?: unknown; rgb?: unknown; rgba?: unknown };
      result.set(newKey, {
        value: String(colorValue.value),
        description: colorValue.description ? String(colorValue.description) : '',
        rgb: colorValue.rgb as string | undefined,
        rgba: colorValue.rgba as string | undefined,
      });
    } else if (value && typeof value === 'object' && 'properties' in value) {
      // This is a category with properties
      flattenColors(value.properties, newKey, result);
    } else if (value && typeof value === 'object') {
      // This is a nested object
      flattenColors(value, newKey, result);
    }
  }
  
  return result;
}

/**
 * Generate TypeScript colors file
 */
function generateTypeScriptFile(colors: Map<string, { value: string; description: string }>): string {
  const sections: Record<string, Array<{ key: string; value: string; description: string }>> = {
    content: [],
    interactive: [],
    background: [],
    border: [],
    base: [],
    sentiment: [],
  };
  
  // Organize colors by category
  for (const [key, color] of colors.entries()) {
    const category = key.split('.')[0];
    if (category in sections) {
      const colorKey = key.split('.').slice(1).join('.');
      sections[category].push({
        key: colorKey,
        value: color.value,
        description: color.description,
      });
    }
  }
  
  let output = `/**
 * Centralized Color System
 * 
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * This file is generated from design tokens
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

`;

  // Generate each section
  for (const [category, items] of Object.entries(sections)) {
    if (items.length === 0) continue;
    
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    output += `/**
 * ${categoryName} Colors - ${getCategoryDescription(category)}
 */
export const ${category} = {\n`;
    
    for (const item of items) {
      const comment = item.description ? `    // ${item.description}` : '';
      output += `${comment}\n    ${item.key}: "${item.value}",\n`;
    }
    
    output += `} as const;\n\n`;
  }
  
  // Add helper functions
  output += `/**
 * Helper function to convert hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle hex with alpha (8 digits)
  if (hex.length === 9) {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }
  
  // Handle regular hex (6 digits)
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
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
  
  return \`\${h} \${s}% \${lPercent}%\`;
}

/**
 * Helper function to get rgba string from hex color
 */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
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
`;

  return output;
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    content: 'For text and content',
    interactive: 'For interactive elements',
    background: 'For larger surface areas',
    border: 'To subtly separate different blocks of content',
    base: 'Useful colors for several different scenarios',
    sentiment: 'To indicate positive, negative, or warning',
  };
  return descriptions[category] || '';
}

/**
 * Generate CSS variables section
 */
function generateCSSVariables(colors: Map<string, { value: string; description: string; rgb?: string; rgba?: string }>, isDarkMode: boolean = false): string {
  let output = '';
  
  // Map colors to CSS variables
  const cssVars: Array<{ varName: string; value: string; comment: string; source: string }> = [];
  
  // Direct mappings
  for (const [tokenPath, cssVar] of Object.entries(CSS_VARIABLE_MAPPINGS)) {
    const color = colors.get(tokenPath);
    if (color) {
      const hsl = hexToHsl(color.value);
      const alpha = extractAlpha(color.value);
      
      let cssValue = hsl;
      if (alpha !== null) {
        cssValue = `${hsl} / ${alpha}`;
      }
      
      cssVars.push({
        varName: cssVar,
        value: cssValue,
        comment: color.description,
        source: tokenPath,
      });
    }
  }
  
  // Legacy primary scale
  const primaryScale = [
    { token: 'interactive.control', var: '--primary-900', comment: 'Interactive Control' },
    { token: 'interactive.control', var: '--primary-800', comment: 'Interactive Control' },
    { token: 'interactive.control', var: '--primary-700', comment: 'Interactive Control' },
    { token: 'interactive.primary', var: '--primary-600', comment: 'Interactive Primary' },
    { token: 'interactive.primary', var: '--primary-500', comment: 'Interactive Primary' },
    { token: 'interactive.accent', var: '--primary-400', comment: 'Interactive Accent' },
    { token: 'interactive.contrast', var: '--primary-300', comment: 'Interactive Contrast' },
  ];
  
  for (const mapping of primaryScale) {
    const color = colors.get(mapping.token);
    if (color) {
      const hsl = hexToHsl(color.value);
      cssVars.push({
        varName: mapping.var,
        value: hsl,
        comment: mapping.comment,
        source: mapping.token,
      });
    }
  }
  
  // Legacy grey scale
  const greyScale = [
    { token: 'background.screen', var: '--grey-50', comment: 'Background Screen' },
    { token: 'base.light', var: '--grey-100', comment: 'Background Screen' },
    { token: 'base.light', var: '--grey-200', comment: 'Background Screen' },
    { token: 'content.tertiary', var: '--grey-300', comment: 'Content Tertiary' },
    { token: 'content.secondary', var: '--grey-400', comment: 'Content Secondary' },
    { token: 'content.primary', var: '--grey-500', comment: 'Content Primary' },
    { token: 'base.dark', var: '--grey-600', comment: 'Base Dark' },
    { token: 'base.dark', var: '--grey-700', comment: 'Base Dark' },
    { token: 'base.dark', var: '--grey-800', comment: 'Base Dark' },
    { token: 'content.primary', var: '--grey-900', comment: 'Content Primary' },
  ];
  
  for (const mapping of greyScale) {
    const color = colors.get(mapping.token);
    if (color) {
      let hsl = hexToHsl(color.value);
      
      // Dark mode adjustments for grey scale
      if (isDarkMode) {
        if (mapping.var === '--grey-50') hsl = '0 0% 9%'; // Base Dark
        if (mapping.var === '--grey-100') hsl = '0 0% 11%';
        if (mapping.var === '--grey-200') hsl = '0 0% 14%';
        if (mapping.var === '--grey-300') {
          const secondary = colors.get('content.secondary');
          if (secondary) hsl = hexToHsl(secondary.value);
        }
        if (mapping.var === '--grey-400') {
          const tertiary = colors.get('content.tertiary');
          if (tertiary) hsl = hexToHsl(tertiary.value);
        }
        if (['--grey-500', '--grey-600', '--grey-700', '--grey-800', '--grey-900'].includes(mapping.var)) {
          hsl = '0 0% 100%'; // Base Contrast
        }
      }
      
      cssVars.push({
        varName: mapping.var,
        value: hsl,
        comment: mapping.comment,
        source: mapping.token,
      });
    }
  }
  
  // Legacy neutral scale
  const neutralScale = [
    { token: 'background.screen', var: '--neutral-50', comment: 'Background Screen' },
    { token: 'base.light', var: '--neutral-100', comment: 'Background Screen' },
    { token: 'base.light', var: '--neutral-200', comment: 'Background Screen' },
    { token: 'content.tertiary', var: '--neutral-300', comment: 'Content Tertiary' },
    { token: 'content.secondary', var: '--neutral-400', comment: 'Content Secondary' },
    { token: 'content.primary', var: '--neutral-500', comment: 'Content Primary' },
    { token: 'base.dark', var: '--neutral-600', comment: 'Base Dark' },
  ];
  
  for (const mapping of neutralScale) {
    const color = colors.get(mapping.token);
    if (color) {
      let hsl = hexToHsl(color.value);
      
      // Dark mode adjustments for neutral scale
      if (isDarkMode) {
        if (mapping.var === '--neutral-50') hsl = '0 0% 9%'; // Base Dark
        if (mapping.var === '--neutral-100') hsl = '0 0% 11%';
        if (mapping.var === '--neutral-200') hsl = '0 0% 14%';
        if (mapping.var === '--neutral-300') {
          const secondary = colors.get('content.secondary');
          if (secondary) hsl = hexToHsl(secondary.value);
        }
        if (mapping.var === '--neutral-400') {
          const tertiary = colors.get('content.tertiary');
          if (tertiary) hsl = hexToHsl(tertiary.value);
        }
        if (['--neutral-500', '--neutral-600'].includes(mapping.var)) {
          hsl = '0 0% 100%'; // Base Contrast
        }
      }
      
      cssVars.push({
        varName: mapping.var,
        value: hsl,
        comment: mapping.comment,
        source: mapping.token,
      });
    }
  }
  
  // Special mappings for dark mode
  if (isDarkMode) {
    // Background becomes dark
    const darkBg = colors.get('base.dark');
    if (darkBg) {
      cssVars.push({
        varName: '--background',
        value: hexToHsl(darkBg.value),
        comment: 'Base Dark',
        source: 'base.dark',
      });
    }
    
    // Foreground becomes white
    const contrast = colors.get('base.contrast');
    if (contrast) {
      cssVars.push({
        varName: '--foreground',
        value: hexToHsl(contrast.value),
        comment: 'Base Contrast',
        source: 'base.contrast',
      });
    }
    
    // Card becomes slightly lighter
    cssVars.push({
      varName: '--card',
      value: '0 0% 11%',
      comment: 'Slightly lighter than background',
      source: 'base.dark',
    });
    
    // Muted becomes slightly lighter
    cssVars.push({
      varName: '--muted',
      value: '0 0% 14%',
      comment: 'Slightly lighter than background',
      source: 'base.dark',
    });
    
    // Border becomes white with alpha
    cssVars.push({
      varName: '--border',
      value: '0 0% 100% / 0.12',
      comment: 'Border Neutral: White with alpha for contrast on dark background',
      source: 'border.neutral',
    });
    
    cssVars.push({
      varName: '--input',
      value: '0 0% 100% / 0.12',
      comment: 'Border Neutral: White with alpha for contrast on dark background',
      source: 'border.neutral',
    });
  }
  
  // Format output
  for (const cssVar of cssVars) {
    const hexColor = colors.get(cssVar.source)?.value || '';
    output += `    ${cssVar.varName}: ${cssVar.value};`;
    if (hexColor) {
      output += `  /* ${cssVar.comment}: ${hexColor} */`;
    }
    output += '\n';
  }
  
  return output;
}

/**
 * Build a map of CSS variable names to their values and comments
 */
function buildCSSVariableMap(colors: Map<string, { value: string; description: string; rgb?: string; rgba?: string }>, isDarkMode: boolean): Map<string, { value: string; comment: string }> {
  const varMap = new Map<string, { value: string; comment: string }>();
  
  // Direct mappings
  for (const [tokenPath, cssVar] of Object.entries(CSS_VARIABLE_MAPPINGS)) {
    const color = colors.get(tokenPath);
    if (color) {
      const hsl = hexToHsl(color.value);
      const alpha = extractAlpha(color.value);
      let cssValue = hsl;
      if (alpha !== null) {
        cssValue = `${hsl} / ${alpha}`;
      }
      varMap.set(cssVar, {
        value: cssValue,
        comment: `${color.description}: ${color.value}`,
      });
    }
  }
  
  // Legacy primary scale
  const primaryScale = [
    { token: 'interactive.control', var: '--primary-900', comment: 'Interactive Control' },
    { token: 'interactive.control', var: '--primary-800', comment: 'Interactive Control' },
    { token: 'interactive.control', var: '--primary-700', comment: 'Interactive Control' },
    { token: 'interactive.primary', var: '--primary-600', comment: 'Interactive Primary' },
    { token: 'interactive.primary', var: '--primary-500', comment: 'Interactive Primary' },
    { token: 'interactive.accent', var: '--primary-400', comment: 'Interactive Accent' },
    { token: 'interactive.contrast', var: '--primary-300', comment: 'Interactive Contrast' },
  ];
  
  for (const mapping of primaryScale) {
    const color = colors.get(mapping.token);
    if (color) {
      const hsl = hexToHsl(color.value);
      varMap.set(mapping.var, {
        value: hsl,
        comment: `${mapping.comment}: ${color.value}`,
      });
    }
  }
  
  // Legacy grey scale
  const greyScale = [
    { token: 'background.screen', var: '--grey-50', comment: 'Background Screen' },
    { token: 'base.light', var: '--grey-100', comment: 'Background Screen' },
    { token: 'base.light', var: '--grey-200', comment: 'Background Screen' },
    { token: 'content.tertiary', var: '--grey-300', comment: 'Content Tertiary' },
    { token: 'content.secondary', var: '--grey-400', comment: 'Content Secondary' },
    { token: 'content.primary', var: '--grey-500', comment: 'Content Primary' },
    { token: 'base.dark', var: '--grey-600', comment: 'Base Dark' },
    { token: 'base.dark', var: '--grey-700', comment: 'Base Dark' },
    { token: 'base.dark', var: '--grey-800', comment: 'Base Dark' },
    { token: 'content.primary', var: '--grey-900', comment: 'Content Primary' },
  ];
  
  for (const mapping of greyScale) {
    const color = colors.get(mapping.token);
    if (color) {
      let hsl = hexToHsl(color.value);
      
      // Dark mode adjustments for grey scale
      if (isDarkMode) {
        if (mapping.var === '--grey-50') hsl = '0 0% 9%';
        if (mapping.var === '--grey-100') hsl = '0 0% 11%';
        if (mapping.var === '--grey-200') hsl = '0 0% 14%';
        if (mapping.var === '--grey-300') {
          const secondary = colors.get('content.secondary');
          if (secondary) hsl = hexToHsl(secondary.value);
        }
        if (mapping.var === '--grey-400') {
          const tertiary = colors.get('content.tertiary');
          if (tertiary) hsl = hexToHsl(tertiary.value);
        }
        if (['--grey-500', '--grey-600', '--grey-700', '--grey-800', '--grey-900'].includes(mapping.var)) {
          hsl = '0 0% 100%';
        }
      }
      
      varMap.set(mapping.var, {
        value: hsl,
        comment: `${mapping.comment}: ${color.value}`,
      });
    }
  }
  
  // Legacy neutral scale
  const neutralScale = [
    { token: 'background.screen', var: '--neutral-50', comment: 'Background Screen' },
    { token: 'base.light', var: '--neutral-100', comment: 'Background Screen' },
    { token: 'base.light', var: '--neutral-200', comment: 'Background Screen' },
    { token: 'content.tertiary', var: '--neutral-300', comment: 'Content Tertiary' },
    { token: 'content.secondary', var: '--neutral-400', comment: 'Content Secondary' },
    { token: 'content.primary', var: '--neutral-500', comment: 'Content Primary' },
    { token: 'base.dark', var: '--neutral-600', comment: 'Base Dark' },
  ];
  
  for (const mapping of neutralScale) {
    const color = colors.get(mapping.token);
    if (color) {
      let hsl = hexToHsl(color.value);
      
      // Dark mode adjustments for neutral scale
      if (isDarkMode) {
        if (mapping.var === '--neutral-50') hsl = '0 0% 9%';
        if (mapping.var === '--neutral-100') hsl = '0 0% 11%';
        if (mapping.var === '--neutral-200') hsl = '0 0% 14%';
        if (mapping.var === '--neutral-300') {
          const secondary = colors.get('content.secondary');
          if (secondary) hsl = hexToHsl(secondary.value);
        }
        if (mapping.var === '--neutral-400') {
          const tertiary = colors.get('content.tertiary');
          if (tertiary) hsl = hexToHsl(tertiary.value);
        }
        if (['--neutral-500', '--neutral-600'].includes(mapping.var)) {
          hsl = '0 0% 100%';
        }
      }
      
      varMap.set(mapping.var, {
        value: hsl,
        comment: `${mapping.comment}: ${color.value}`,
      });
    }
  }
  
  // Special mappings for dark mode
  if (isDarkMode) {
    const darkBg = colors.get('base.dark');
    if (darkBg) {
      varMap.set('--background', {
        value: hexToHsl(darkBg.value),
        comment: `Base Dark: ${darkBg.value}`,
      });
    }
    
    const contrast = colors.get('base.contrast');
    if (contrast) {
      varMap.set('--foreground', {
        value: hexToHsl(contrast.value),
        comment: `Base Contrast: ${contrast.value}`,
      });
    }
    
    varMap.set('--card', {
      value: '0 0% 11%',
      comment: 'Slightly lighter than background',
    });
    
    varMap.set('--muted', {
      value: '0 0% 14%',
      comment: 'Slightly lighter than background',
    });
    
    varMap.set('--border', {
      value: '0 0% 100% / 0.12',
      comment: 'Border Neutral: White with alpha for contrast on dark background',
    });
    
    varMap.set('--input', {
      value: '0 0% 100% / 0.12',
      comment: 'Border Neutral: White with alpha for contrast on dark background',
    });
  }
  
  // Sentiment colors
  const sentimentColors = [
    { token: 'sentiment.negative', var: '--sentiment-negative', comment: 'Sentiment Negative' },
    { token: 'sentiment.positive', var: '--sentiment-positive', comment: 'Sentiment Positive' },
    { token: 'sentiment.warning', var: '--sentiment-warning', comment: 'Sentiment Warning' },
  ];
  
  for (const mapping of sentimentColors) {
    const color = colors.get(mapping.token);
    if (color) {
      const hsl = hexToHsl(color.value);
      varMap.set(mapping.var, {
        value: hsl,
        comment: `${mapping.comment}: ${color.value}`,
      });
    }
  }
  
  return varMap;
}

/**
 * Update CSS variables in globals.css
 */
function updateGlobalsCSS(globalsCss: string, colors: Map<string, { value: string; description: string; rgb?: string; rgba?: string }>): string {
  const lightModeVars = buildCSSVariableMap(colors, false);
  const darkModeVars = buildCSSVariableMap(colors, true);
  
  let updatedCss = globalsCss;
  
  // Replace variables in :root block
  updatedCss = updatedCss.replace(
    /(:root\s*\{)([\s\S]*?)(\})/,
    (match, opening, content, closing) => {
      let newContent = content;
      
      // Replace each variable
      for (const [varName, varData] of lightModeVars.entries()) {
        // Match: --var-name: value; /* comment */
        const regex = new RegExp(`(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*)[^;]+(;\\s*\\/\\*[^\\*]*\\*\\/)?`, 'g');
        newContent = newContent.replace(regex, `${varName}: ${varData.value};  /* ${varData.comment} */`);
      }
      
      return opening + newContent + closing;
    }
  );
  
  // Replace in .dark block
  updatedCss = updatedCss.replace(
    /(\.dark\s*\{)([\s\S]*?)(\})/,
    (match, opening, content, closing) => {
      let newContent = content;
      
      // Replace each variable
      for (const [varName, varData] of darkModeVars.entries()) {
        // Match: --var-name: value; /* comment */
        const regex = new RegExp(`(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*)[^;]+(;\\s*\\/\\*[^\\*]*\\*\\/)?`, 'g');
        newContent = newContent.replace(regex, `${varName}: ${varData.value};  /* ${varData.comment} */`);
      }
      
      return opening + newContent + closing;
    }
  );
  
  return updatedCss;
}

/**
 * Main function
 */
function main() {
  // NOTE: spareds directory has been removed
  // If you need to sync colors, update these paths to point to your new token source
  const tokensPath = path.join(process.cwd(), 'spareds/tokens/colors/default-values.json');
  const publicTokensPath = path.join(process.cwd(), 'public/spareds/tokens/colors/default-values.json');
  
  // Check if paths exist, if not, skip sync
  if (!fs.existsSync(tokensPath)) {
    console.warn('⚠️  Color tokens file not found. Skipping color sync.');
    console.warn(`   Expected path: ${tokensPath}`);
    return;
  }
  const colorsTsPath = path.join(process.cwd(), 'lib/design-system/colors.ts');
  const globalsCssPath = path.join(process.cwd(), 'app/globals.css');
  
  // Read tokens file
  console.log('📖 Reading color tokens...');
  const tokensContent = fs.readFileSync(tokensPath, 'utf-8');
  const tokens = JSON.parse(tokensContent);
  
  // Flatten colors
  const colors = flattenColors(tokens.properties);
  
  console.log(`✅ Found ${colors.size} color tokens`);
  
  // Sync to public folder
  console.log('📋 Syncing tokens to public folder...');
  fs.writeFileSync(publicTokensPath, tokensContent, 'utf-8');
  console.log(`✅ Synced ${publicTokensPath}`);
  
  // Generate TypeScript file
  console.log('📝 Generating TypeScript colors file...');
  const tsContent = generateTypeScriptFile(colors);
  fs.writeFileSync(colorsTsPath, tsContent, 'utf-8');
  console.log(`✅ Generated ${colorsTsPath}`);
  
  // Read existing globals.css
  console.log('📖 Reading globals.css...');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');
  
  // Update CSS variables in globals.css
  console.log('🎨 Updating CSS variables in globals.css...');
  const updatedCss = updateGlobalsCSS(globalsCss, colors);
  fs.writeFileSync(globalsCssPath, updatedCss, 'utf-8');
  console.log(`✅ Updated ${globalsCssPath}`);
  
  console.log('\n✨ Color synchronization complete!');
  console.log('\n📋 Summary:');
  console.log(`   - TypeScript file: ${colorsTsPath}`);
  console.log(`   - CSS variables: ${globalsCssPath}`);
  console.log(`   - Public tokens: ${publicTokensPath}`);
  console.log(`   - Colors synchronized: ${colors.size}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Review the generated files');
  console.log('   2. Run the app to verify colors are correct');
  console.log('   3. Commit the changes');
}

// Run the script
main();

