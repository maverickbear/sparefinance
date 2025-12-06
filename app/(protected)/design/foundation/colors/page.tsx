'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { colors, hexToRgb } from '@/lib/design-system/colors';

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
  prefix: string = '',
  tokenPath: string = ''
): ColorEntry[] {
  const colorEntries: ColorEntry[] = [];

  if (!obj || typeof obj !== 'object') {
    return colorEntries;
  }

  for (const [key, val] of Object.entries(obj)) {
    const fullName = prefix ? `${prefix}.${key}` : key;
    const fullTokenPath = tokenPath ? `${tokenPath}.${key}` : key;

    if (typeof val === 'string' && val.startsWith('#')) {
      // This is a color value
      const rgbResult = hexToRgb(val);
      const rgbValue = rgbResult ? `${rgbResult.r} / ${rgbResult.g} / ${rgbResult.b}` : null;
      const hasAlpha = val.length === 9;
      
      colorEntries.push({
        name: fullName,
        value: val,
        description: getColorDescription(fullName),
        tokenPath: fullTokenPath,
        rgb: rgbValue || undefined,
        rgba: hasAlpha && rgbValue ? `${rgbValue} / ${(parseInt(val.slice(7, 9), 16) / 255).toFixed(2)}` : undefined,
      });
    } else if (val && typeof val === 'object') {
      // Recursively extract from nested objects
      colorEntries.push(
        ...extractColorsFromObject(val, fullName, fullTokenPath)
      );
    }
  }

  return colorEntries;
}

function getColorDescription(colorPath: string): string {
  const descriptions: Record<string, string> = {
    'content.primary': 'Use to emphasise primary content in relation to other elements nearby',
    'content.secondary': 'Use for most body text, and in supportive elements that give context to content that\'s close to it',
    'content.tertiary': 'Use in form inputs for placeholders, and for the label that says a field is \'Optional\'. Avoid using elsewhere',
    'content.link': 'Use for links and for external link icons that appear in line with link text',
    'interactive.primary': 'For neutral interactive elements or emphasising active items in a list',
    'interactive.accent': 'For sparing use as an accent colour in interactive elements, such as primary button backgrounds',
    'interactive.secondary': 'For de-emphasised interactivity, like borders on inputs and checkboxes, and clear buttons on search inputs. Do not use on text',
    'interactive.control': 'For text and icons on a Bright Green Interactive Accent surface, ensuring visibility in dark mode, and also for surfaces if needed',
    'interactive.contrast': 'For text and icons on a Forest Green Interactive Primary surface, ensuring visibility in dark mode',
    'background.screen': 'The lowest level background used in most screens',
    'background.elevated': 'Use for elevated surfaces that partially show the content behind it, like bottom sheets and sidebars',
    'background.neutral': 'Use for delineating areas without using borders, like neutral alerts and avatars',
    'background.overlay': 'Use for faintly darkening an area, for example on loading shimmers',
    'border.neutral': 'Use in most separators, for example in the section header and tabs components',
    'border.overlay': 'Use on the edges of images to differentiate them from the background, such as flags in avatars',
    'base.contrast': 'Use for copy on negative buttons. Turns dark on dark mode to keep elements visible',
    'base.light': 'Use in informational or interactive elements where white is needed, or where other colours would be too prominent in the hierarchy',
    'base.dark': 'Use in informational or interactive elements where a dark colour is needed',
    'sentiment.negative': 'Indicates negative sentiment, for example on error states or destructive actions. Can be used as text or as a background',
    'sentiment.positive': 'Indicates positive sentiment, for example in positive alerts. Can be used as text or as a background',
    'sentiment.warning': 'Indicates warning sentiment, for example on alerts. Should only be used as a background colour and is not accessible as text',
  };
  
  return descriptions[colorPath] || '';
}

function ColorSwatch({ name, value, description, tokenPath, rgb, rgba }: ColorEntry) {
  const isHex = /^#[0-9A-Fa-f]{6,8}$/i.test(value);
  const hasAlpha = value.length === 9;
  
  let bgColor = value;
  let displayValue = value;
  let rgbValue = rgb || rgba;
  
  // If no RGB value provided, calculate it from hex
  if (!rgbValue && isHex) {
    const rgbResult = hexToRgb(value);
    if (rgbResult) {
      rgbValue = `${rgbResult.r} / ${rgbResult.g} / ${rgbResult.b}`;
      if (hasAlpha) {
        const alpha = (parseInt(value.slice(7, 9), 16) / 255).toFixed(2);
        rgbValue = `${rgbValue} / ${alpha}`;
      }
    }
  }

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
  // Extract colors from the colors object
  const allColors = extractColorsFromObject(colors, '', 'colors');

  // Organize colors by category
  const contentColors = allColors.filter((c) => c.name.startsWith('content'));
  const interactiveColors = allColors.filter((c) => c.name.startsWith('interactive'));
  const backgroundColors = allColors.filter((c) => c.name.startsWith('background'));
  const borderColors = allColors.filter((c) => c.name.startsWith('border'));
  const baseColors = allColors.filter((c) => c.name.startsWith('base'));
  const sentimentColors = allColors.filter((c) => c.name.startsWith('sentiment'));

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

