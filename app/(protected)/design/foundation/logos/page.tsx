'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogosPage() {
  return (
    <div className="p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Logo Assets</CardTitle>
              <CardDescription>
                Brand logos and visual assets for Spare Finance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Primary Logo</h3>
                  <p className="text-muted-foreground mb-4">
                    The primary Spare Finance logo. Use this as the default logo in most contexts.
                  </p>
                  <div className="bg-muted p-8 rounded-lg flex items-center justify-center min-h-[200px]">
                    <p className="text-muted-foreground">Logo placeholder - Add logo assets here</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Logo Variations</h3>
                  <p className="text-muted-foreground mb-4">
                    Different variations of the logo for various use cases (light, dark, icon-only, etc.)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted p-8 rounded-lg flex items-center justify-center min-h-[150px]">
                      <p className="text-muted-foreground text-sm">Light variant</p>
                    </div>
                    <div className="bg-foreground p-8 rounded-lg flex items-center justify-center min-h-[150px]">
                      <p className="text-muted-foreground text-sm text-background">Dark variant</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Usage Guidelines</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>• Maintain minimum clear space around the logo</p>
                    <p>• Use appropriate logo variant based on background</p>
                    <p>• Do not distort or modify the logo</p>
                    <p>• Ensure sufficient contrast for accessibility</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

