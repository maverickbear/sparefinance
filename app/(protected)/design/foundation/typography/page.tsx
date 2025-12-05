'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Tailwind default font sizes mapping
const fontSizes = [
  { token: 'text-xs', size: '0.75rem', pixels: '12px', description: 'Extra small text - Used for badges, labels, and very small captions' },
  { token: 'text-sm', size: '0.875rem', pixels: '14px', description: 'Small text - Used for captions, labels, and supportive text' },
  { token: 'text-base', size: '1rem', pixels: '16px', description: 'Base text - Regular paragraph text. Default body size' },
  { token: 'text-lg', size: '1.125rem', pixels: '18px', description: 'Large text - Used for emphasized body text and subheadings' },
  { token: 'text-xl', size: '1.25rem', pixels: '20px', description: 'Extra large text - Used for Heading 4' },
  { token: 'text-2xl', size: '1.5rem', pixels: '24px', description: '2XL text - Used for Heading 3' },
  { token: 'text-3xl', size: '1.875rem', pixels: '30px', description: '3XL text - Used for Heading 2' },
  { token: 'text-4xl', size: '2.25rem', pixels: '36px', description: '4XL text - Used for Heading 1' },
  { token: 'text-5xl', size: '3rem', pixels: '48px', description: '5XL text - Used for large display headings' },
  { token: 'text-6xl', size: '3.75rem', pixels: '60px', description: '6XL text - Used for hero headings' },
  { token: 'text-7xl', size: '4.5rem', pixels: '72px', description: '7XL text - Used for very large display text' },
  { token: 'text-8xl', size: '6rem', pixels: '96px', description: '8XL text - Used for extra large display text' },
  { token: 'text-9xl', size: '8rem', pixels: '128px', description: '9XL text - Used for maximum display text' },
];

export default function TypographyPage() {
  return (
    <div className="p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Font Size Tokens</CardTitle>
              <CardDescription>
                Complete list of all font sizes used in the project with their corresponding tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {fontSizes.map((fontSize) => (
                  <div key={fontSize.token} className="border-b border-border pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <p className={`${fontSize.token} font-semibold mb-1 text-foreground`}>
                          The quick brown fox jumps over the lazy dog
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          {fontSize.description}
                        </p>
                      </div>
                      <div className="text-right min-w-[200px]">
                        <div className="text-sm font-mono bg-muted px-2 py-1 rounded mb-1">
                          {fontSize.token}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fontSize.size} / {fontSize.pixels}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Type Scale - Common Usage</CardTitle>
              <CardDescription>
                Typography scale and usage guidelines for common headings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold mb-2 text-foreground">Heading 1</h1>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-4xl</code> (2.25rem / 36px)</p>
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2 text-foreground">Heading 2</h2>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-3xl</code> (1.875rem / 30px)</p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-foreground">Heading 3</h3>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-2xl</code> (1.5rem / 24px)</p>
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2 text-foreground">Heading 4</h4>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-xl</code> (1.25rem / 20px)</p>
                </div>
                <div>
                  <p className="text-base mb-2 text-muted-foreground">Body text - Regular paragraph text. Use content.secondary for most body text and supportive elements.</p>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-base</code> (1rem / 16px)</p>
                </div>
                <div>
                  <p className="text-sm mb-2 text-muted-foreground">Small text - Used for captions and labels. Use content.secondary for supportive text.</p>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-sm</code> (0.875rem / 14px)</p>
                </div>
                <div>
                  <p className="text-xs mb-2 text-muted-foreground">Extra small text - Used for badges, labels, and very small captions.</p>
                  <p className="text-sm text-muted-foreground">Token: <code className="bg-muted px-1 py-0.5 rounded">text-xs</code> (0.75rem / 12px)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content Colors Usage</CardTitle>
              <CardDescription>
                Guidelines for using content.primary and content.secondary
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold mb-2 text-foreground">content.primary</h4>
                  <p className="text-muted-foreground mb-2">
                    Use to emphasise primary content in relation to other elements nearby.
                  </p>
                  <p className="text-foreground">
                    This is an example of content.primary - use for headings, titles, and important text.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2 text-foreground">content.secondary</h4>
                  <p className="text-muted-foreground mb-2">
                    Use for most body text, and in supportive elements that give context to content that's close to it.
                  </p>
                  <p className="text-muted-foreground">
                    This is an example of content.secondary - use for body text, descriptions, labels, and captions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

