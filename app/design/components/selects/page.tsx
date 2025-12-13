"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function SelectsPage() {
  return (
    <div className="w-full">
      <div className="p-4 lg:p-8 space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Selects</h1>
          <p className="text-muted-foreground">
            Select component with different sizes and states used throughout the system
          </p>
        </div>

        {/* Sizes */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Sizes</h2>
          <Card>
            <CardHeader>
              <CardTitle>All Sizes</CardTitle>
              <CardDescription>Select size variants with consistent heights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tiny (h-8)</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Small (h-9)</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Medium (h-10) - Default</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Large (h-11)</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <code className="text-sm whitespace-pre-wrap">
{`<Select>
  <SelectTrigger size="medium">
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>`}
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
                <CardTitle>Small Select</CardTitle>
                <CardDescription>Select with label and helper text</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="small-select">Country</Label>
                  <Select>
                    <SelectTrigger id="small-select" size="medium">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select your country</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Medium Select</CardTitle>
                <CardDescription>Default size select with label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="medium-select">Country</Label>
                  <Select>
                    <SelectTrigger id="medium-select" size="medium">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select your country</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Large Select</CardTitle>
                <CardDescription>Large size select with label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="large-select">Country</Label>
                  <Select>
                    <SelectTrigger id="large-select" size="medium">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select your country</p>
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
              <CardTitle>Select States</CardTitle>
              <CardDescription>Normal and disabled states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Normal State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="normal-select">Normal Select</Label>
                    <Select>
                      <SelectTrigger id="normal-select">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Disabled State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="disabled-select">Disabled Select</Label>
                    <Select disabled>
                      <SelectTrigger id="disabled-select">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">With Default Value</h3>
                  <div className="space-y-2">
                    <Label htmlFor="default-select">Select with Default</Label>
                    <Select defaultValue="option2">
                      <SelectTrigger id="default-select">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                      </SelectContent>
                    </Select>
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
              <CardDescription>Compare all select sizes to see height consistency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tiny</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Small</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Medium</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Large</Label>
                  <Select>
                    <SelectTrigger size="medium">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <h4 className="font-medium mb-1">Tiny (h-8)</h4>
                  <p className="text-sm text-muted-foreground">
                    Very compact spaces, dense tables, minimal UI
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Small (h-9)</h4>
                  <p className="text-sm text-muted-foreground">
                    Compact forms, tables, secondary selections
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
                    Prominent forms, hero sections, important selections
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
                    Every select should have a clear, descriptive label
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Provide Placeholders</h4>
                  <p className="text-sm text-muted-foreground">
                    Use placeholders to guide users on what to select
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Consistent Sizing</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the same size for all selects in a form for consistency
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

