'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Tokens import removed - spareds directory no longer exists
// TODO: Update this page to use alternative token source if needed
const tokens: any = {};
const defaultValuesTokens: any = {};

type ColorEntry = {
  name: string;
  value: string;
  description?: string;
  tokenPath: string;
  rgb?: string;
  rgba?: string;
};

function extractColorsFromObject(
  obj: any,
  defaultValues: any,
  prefix: string = '',
  tokenPath: string = ''
): ColorEntry[] {
  const colors: ColorEntry[] = [];

  if (!obj || typeof obj !== 'object') {
    return colors;
  }

  // Handle objects with 'properties' key (JSON Schema format)
  const target = obj.properties || obj;

  for (const [key, val] of Object.entries(target)) {
    const fullName = prefix ? `${prefix}.${key}` : key;
    const fullTokenPath = tokenPath ? `${tokenPath}.${key}` : key;

    if (val && typeof val === 'object' && 'value' in val) {
      // This is a color entry
      const colorValue = (val as any).value;
      const resolvedValue = resolveTokenReference(colorValue, defaultValues);
      
      // Try to get RGB/RGBA from default values if not present
      let rgb = (val as any).rgb;
      let rgba = (val as any).rgba;
      
      if (!rgb && !rgba) {
        // Try to find in default values
        const defaultPath = fullTokenPath.split('.').slice(1); // Remove 'default-values' prefix
        let current: any = defaultValues;
        for (const pathKey of defaultPath) {
          if (current && typeof current === 'object') {
            if ('properties' in current && pathKey in current.properties) {
              current = current.properties[pathKey];
            } else if (pathKey in current) {
              current = current[pathKey];
            } else {
              current = null;
              break;
            }
          } else {
            current = null;
            break;
          }
        }
        if (current && typeof current === 'object') {
          rgb = current.rgb;
          rgba = current.rgba;
        }
      }
      
      colors.push({
        name: fullName,
        value: resolvedValue,
        description: (val as any).description,
        tokenPath: fullTokenPath,
        rgb,
        rgba,
      });
    } else if (val && typeof val === 'object') {
      // Recursively extract from nested objects
      colors.push(
        ...extractColorsFromObject(val, defaultValues, fullName, fullTokenPath)
      );
    }
  }

  return colors;
}

function resolveTokenReference(value: string, defaultValues: any): string {
  // Handle references like {content.primary}
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const path = value.slice(1, -1).split('.');
    let current: any = defaultValues;

    // Navigate through the path
    for (const key of path) {
      if (current && typeof current === 'object') {
        // Check if it's a JSON Schema format with 'properties'
        if ('properties' in current && key in current.properties) {
          current = current.properties[key];
        } else if (key in current) {
          current = current[key];
        } else {
          return value; // Path not found, return original
        }
      } else {
        return value; // Path not found, return original
      }
    }

    // If we found a value, extract it
    if (current && typeof current === 'object' && 'value' in current) {
      return current.value;
    }
    if (typeof current === 'string') {
      return current;
    }
    return value;
  }
  return value;
}

function hexToRgb(hex: string): string | null {
  // Handle hex with alpha (8 digits)
  if (hex.length === 9) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = (parseInt(hex.slice(7, 9), 16) / 255).toFixed(2);
    return `${r} / ${g} / ${b} / ${a}`;
  }
  // Handle regular hex (6 digits)
  if (hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r} / ${g} / ${b}`;
  }
  return null;
}

function ColorSwatch({ name, value, description, tokenPath, rgb, rgba }: ColorEntry) {
  const isHex = /^#[0-9A-Fa-f]{6,8}$/i.test(value);
  const hasAlpha = value.length === 9;
  
  let bgColor = value;
  let displayValue = value;
  let rgbValue = rgb || rgba || hexToRgb(value);

  // Determine text color for contrast
  const getContrastColor = (hex: string): string => {
    if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return '#000000';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  const textColor = isHex && !hasAlpha ? getContrastColor(bgColor) : '#000000';

  return (
    <div className="flex flex-col gap-2">
      <div
        className="w-full h-32 rounded-lg border border-border shadow-sm flex items-center justify-center relative"
        style={{ backgroundColor: bgColor }}
      >
        {hasAlpha && (
          <div 
            className="absolute inset-0 rounded-lg bg-[length:20px_20px] bg-[0_0,10px_10px]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
            }}
          />
        )}
        <div
          className="w-full h-full rounded-lg flex flex-col items-center justify-center p-4 relative z-10"
          style={{ backgroundColor: bgColor }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: textColor }}
          >
            {name}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="font-mono text-sm font-semibold text-foreground break-words">
          {name}
        </div>
        <div className="font-mono text-xs text-muted-foreground break-all">
          {displayValue}
        </div>
        {rgbValue && (
          <div className="font-mono text-xs text-muted-foreground">
            {rgba ? 'RGBA' : 'RGB'}: {rgbValue}
          </div>
        )}
        <div className="text-xs text-muted-foreground font-mono">
          Token: {tokenPath}
        </div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1">{description}</div>
        )}
      </div>
    </div>
  );
}

function ColorCategory({
  title,
  description,
  colors,
}: {
  title: string;
  description?: string;
  colors: ColorEntry[];
}) {
  if (colors.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {colors.map((color) => (
            <ColorSwatch key={color.tokenPath} {...color} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ColorsPage() {
  // Extract colors from default values (Level 1)
  const defaultColors = extractColorsFromObject(
    defaultValuesTokens,
    defaultValuesTokens,
    '',
    'default-values'
  );

  // Extract semantic colors (Level 2)
  const semanticColors = extractColorsFromObject(
    tokens.semantic,
    defaultValuesTokens,
    '',
    'semantic'
  );

  // Organize colors by category
  const contentColors = defaultColors.filter((c) => c.name.startsWith('content'));
  const interactiveColors = defaultColors.filter((c) => c.name.startsWith('interactive'));
  const backgroundColors = defaultColors.filter((c) => c.name.startsWith('background'));
  const borderColors = defaultColors.filter((c) => c.name.startsWith('border'));
  const baseColors = defaultColors.filter((c) => c.name.startsWith('base'));
  const sentimentColors = defaultColors.filter((c) => c.name.startsWith('sentiment'));

  return (
    <div className="p-4 lg:p-8">
        <div className="space-y-12 max-w-7xl mx-auto">
          {/* Content Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Content Colours
            </h2>
            <p className="text-muted-foreground mb-6">
              Colors for text and content
            </p>
            <ColorCategory
              title="Content Colours"
              colors={contentColors}
            />
          </section>

          {/* Interactive Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Interactive Colours
            </h2>
            <p className="text-muted-foreground mb-6">
              Colors for interactive elements
            </p>
            <ColorCategory
              title="Interactive Colours"
              colors={interactiveColors}
            />
          </section>

          {/* Background Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Background Colours
            </h2>
            <p className="text-muted-foreground mb-6">
              Background colours are used for larger surface areas that are light enough to be overlayed with content and other components
            </p>
            <ColorCategory
              title="Background Colours"
              colors={backgroundColors}
            />
          </section>

          {/* Border Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Border Colours
            </h2>
            <p className="text-muted-foreground mb-6">
              We use border colours to subtly separate different blocks of content
            </p>
            <ColorCategory
              title="Border Colours"
              colors={borderColors}
            />
          </section>

          {/* Base Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Base Colours
            </h2>
            <p className="text-muted-foreground mb-6">
              Base colours are useful colours that we can use in several different scenarios
            </p>
            <ColorCategory
              title="Base Colours"
              colors={baseColors}
            />
          </section>

          {/* Sentiment Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Sentiment Colours
            </h2>
            <p className="text-muted-foreground mb-6">
              Our sentiment colours are used to indicate positive, negative, or warning. They're needed in components like alerts and error messages. But it's best to avoid using them elsewhere on screens where possible. If you need to emphasise text, it's better to use bold and the Content Primary instead.
            </p>
            <ColorCategory
              title="Sentiment Colours"
              colors={sentimentColors}
            />
          </section>

          {/* Dark Mode Preview */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Dark Mode
            </h2>
            <p className="text-muted-foreground mb-6">
              How colors appear in dark mode. Toggle dark mode using the theme switcher in the navigation menu to see the full effect. Some colors change in dark mode for better contrast and readability.
            </p>
            <Card>
              <CardHeader>
                <CardTitle>Color Changes in Dark Mode</CardTitle>
                <CardDescription>
                  Key color mappings that change between light and dark modes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Content Primary */}
                  <div className="p-4 rounded-lg border border-border bg-muted/50">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold mb-2 text-foreground">content.primary</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-border" style={{ backgroundColor: '#0E0F0C' }}></div>
                            <div>
                              <p className="text-xs font-medium text-foreground">Light Mode</p>
                              <p className="text-xs text-muted-foreground">#0E0F0C</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-border bg-white"></div>
                            <div>
                              <p className="text-xs font-medium text-foreground">Dark Mode</p>
                              <p className="text-xs text-muted-foreground">#FFFFFF (white for contrast)</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background Screen */}
                  <div className="p-4 rounded-lg border border-border bg-muted/50">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold mb-2 text-foreground">background.screen</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-border bg-white"></div>
                            <div>
                              <p className="text-xs font-medium text-foreground">Light Mode</p>
                              <p className="text-xs text-muted-foreground">#FFFFFF</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-border" style={{ backgroundColor: '#181818' }}></div>
                            <div>
                              <p className="text-xs font-medium text-foreground">Dark Mode</p>
                              <p className="text-xs text-muted-foreground">#181818 (base.dark)</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content Secondary - stays same */}
                  <div className="p-4 rounded-lg border border-border bg-muted/50">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold mb-2 text-foreground">content.secondary</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-border" style={{ backgroundColor: '#454745' }}></div>
                            <div>
                              <p className="text-xs font-medium text-foreground">Light & Dark Mode</p>
                              <p className="text-xs text-muted-foreground">#454745 (same in both modes)</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Primary - stays same */}
                  <div className="p-4 rounded-lg border border-border bg-muted/50">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold mb-2 text-foreground">interactive.primary</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-border" style={{ backgroundColor: '#94DD78' }}></div>
                            <div>
                              <p className="text-xs font-medium text-foreground">Light & Dark Mode</p>
                              <p className="text-xs text-muted-foreground">#94DD78 (same in both modes)</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note about dark mode */}
                  <div className="p-4 rounded-lg border border-border bg-primary/10">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">💡 Tip:</strong> Use the theme switcher in the navigation menu (user menu) to toggle between light and dark modes and see how all colors adapt throughout the application.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
    </div>
  );
}

