"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function InputsPage() {
  return (
    <div className="w-full">
      <div className="p-4 lg:p-8 space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Inputs</h1>
          <p className="text-muted-foreground">
            Input component with different sizes, states, and types used throughout the system
          </p>
        </div>

        {/* Sizes */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Sizes</h2>
          <Card>
            <CardHeader>
              <CardTitle>All Sizes</CardTitle>
              <CardDescription>Input size variants with consistent heights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tiny (h-8)</Label>
                  <Input size="medium" placeholder="Tiny input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Small (h-9)</Label>
                  <Input size="medium" placeholder="Small input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Medium (h-10) - Default</Label>
                  <Input size="medium" placeholder="Medium input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Large (h-11)</Label>
                  <Input size="medium" placeholder="Large input" />
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <code className="text-sm">
                  {`<Input size="medium" placeholder="Small input" />`}
                </code>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* With Labels */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">With Labels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Small Input</CardTitle>
                <CardDescription>Input with label and helper text</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="small-input">Email</Label>
                  <Input id="small-input" size="medium" type="email" placeholder="name@example.com" />
                  <p className="text-xs text-muted-foreground">Enter your email address</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Medium Input</CardTitle>
                <CardDescription>Default size input with label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="medium-input">Email</Label>
                  <Input id="medium-input" size="medium" type="email" placeholder="name@example.com" />
                  <p className="text-xs text-muted-foreground">Enter your email address</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Large Input</CardTitle>
                <CardDescription>Large size input with label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="large-input">Email</Label>
                  <Input id="large-input" size="medium" type="email" placeholder="name@example.com" />
                  <p className="text-xs text-muted-foreground">Enter your email address</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Input Types */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Input Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Text Input</CardTitle>
                <CardDescription>Standard text input</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-input">Name</Label>
                  <Input id="text-input" type="text" placeholder="John Doe" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Input</CardTitle>
                <CardDescription>Email input with validation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-input">Email</Label>
                  <Input id="email-input" type="email" placeholder="name@example.com" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Password Input</CardTitle>
                <CardDescription>Password input with hidden text</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password-input">Password</Label>
                  <Input id="password-input" type="password" placeholder="••••••••" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Number Input</CardTitle>
                <CardDescription>Number input for numeric values</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="number-input">Amount</Label>
                  <Input id="number-input" type="number" placeholder="0.00" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* States */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">States</h2>
          <Card>
            <CardHeader>
              <CardTitle>Input States</CardTitle>
              <CardDescription>Normal, disabled, and error states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Normal State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="normal-input">Normal Input</Label>
                    <Input id="normal-input" placeholder="Enter text..." />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Disabled State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="disabled-input">Disabled Input</Label>
                    <Input id="disabled-input" placeholder="Disabled input" disabled />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Read-only State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="readonly-input">Read-only Input</Label>
                    <Input id="readonly-input" value="Read-only value" readOnly />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Size Comparison */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Size Comparison</h2>
          <Card>
            <CardHeader>
              <CardTitle>All Sizes Side by Side</CardTitle>
              <CardDescription>Compare all input sizes to see height consistency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Small</Label>
                  <Input size="medium" placeholder="Small input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Medium</Label>
                  <Input size="medium" placeholder="Medium input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Large</Label>
                  <Input size="medium" placeholder="Large input" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Usage Guidelines */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Usage Guidelines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Size Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Small (h-9)</h4>
                  <p className="text-sm text-muted-foreground">
                    Compact forms, tables, secondary inputs
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Medium (h-10) - Default</h4>
                  <p className="text-sm text-muted-foreground">
                    Standard forms, most common use case
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Large (h-11)</h4>
                  <p className="text-sm text-muted-foreground">
                    Prominent forms, hero sections, important inputs
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Always Use Labels</h4>
                  <p className="text-sm text-muted-foreground">
                    Every input should have a clear, descriptive label
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Provide Placeholders</h4>
                  <p className="text-sm text-muted-foreground">
                    Use placeholders to show expected format or example
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Consistent Sizing</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the same size for all inputs in a form for consistency
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

