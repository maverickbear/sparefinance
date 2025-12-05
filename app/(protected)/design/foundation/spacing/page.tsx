'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SpacingPage() {
  const spacingScale = [
    { name: '0', value: '0px', usage: 'No spacing' },
    { name: '1', value: '4px', usage: 'Tight spacing' },
    { name: '2', value: '8px', usage: 'Small spacing' },
    { name: '3', value: '12px', usage: 'Medium spacing' },
    { name: '4', value: '16px', usage: 'Default spacing' },
    { name: '6', value: '24px', usage: 'Large spacing' },
    { name: '8', value: '32px', usage: 'Extra large spacing' },
    { name: '12', value: '48px', usage: 'Section spacing' },
    { name: '16', value: '64px', usage: 'Page spacing' },
  ];

  return (
    <div className="p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Spacing Scale</CardTitle>
              <CardDescription>
                Use these spacing values consistently across the design system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spacingScale.map((spacing) => (
                  <div key={spacing.name} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-mono text-muted-foreground">
                      {spacing.name}
                    </div>
                    <div className="flex-1">
                      <div
                        className="bg-primary h-6 rounded"
                        style={{ width: spacing.value }}
                      />
                    </div>
                    <div className="w-32 text-sm font-mono text-muted-foreground">
                      {spacing.value}
                    </div>
                    <div className="w-48 text-sm text-muted-foreground">
                      {spacing.usage}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

