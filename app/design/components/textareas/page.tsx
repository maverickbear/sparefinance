"use client";

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function TextareasPage() {
  return (
    <div className="w-full">
      <div className="p-4 lg:p-8 space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Textareas</h1>
          <p className="text-muted-foreground">
            Textarea component with different sizes and states used throughout the system
          </p>
        </div>

        {/* Sizes */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Sizes</h2>
          <Card>
            <CardHeader>
              <CardTitle>All Sizes</CardTitle>
              <CardDescription>Textarea size variants with consistent padding and typography</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tiny (min-h-[60px])</Label>
                  <Textarea size="medium" placeholder="Tiny textarea..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Small (min-h-[80px])</Label>
                  <Textarea size="medium" placeholder="Small textarea..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Medium (min-h-[100px]) - Default</Label>
                  <Textarea size="medium" placeholder="Medium textarea..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Large (min-h-[120px])</Label>
                  <Textarea size="medium" placeholder="Large textarea..." />
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <code className="text-sm">
                  {`<Textarea size="medium" placeholder="Small textarea..." />`}
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
                <CardTitle>Small Textarea</CardTitle>
                <CardDescription>Textarea with label and helper text</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="small-textarea">Description</Label>
                  <Textarea id="small-textarea" size="medium" placeholder="Enter a short description..." />
                  <p className="text-xs text-muted-foreground">Brief description of the item</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Medium Textarea</CardTitle>
                <CardDescription>Default size textarea with label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="medium-textarea">Description</Label>
                  <Textarea id="medium-textarea" size="medium" placeholder="Enter a description..." />
                  <p className="text-xs text-muted-foreground">Detailed description of the item</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Large Textarea</CardTitle>
                <CardDescription>Large size textarea with label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="large-textarea">Description</Label>
                  <Textarea id="large-textarea" size="medium" placeholder="Enter a detailed description..." />
                  <p className="text-xs text-muted-foreground">Comprehensive description of the item</p>
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
              <CardTitle>Textarea States</CardTitle>
              <CardDescription>Normal, disabled, and read-only states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Normal State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="normal-textarea">Normal Textarea</Label>
                    <Textarea id="normal-textarea" placeholder="Enter text..." />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Disabled State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="disabled-textarea">Disabled Textarea</Label>
                    <Textarea id="disabled-textarea" placeholder="Disabled textarea" disabled />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Read-only State</h3>
                  <div className="space-y-2">
                    <Label htmlFor="readonly-textarea">Read-only Textarea</Label>
                    <Textarea id="readonly-textarea" value="This is a read-only textarea value that cannot be edited." readOnly />
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
              <CardDescription>Compare all textarea sizes to see padding and typography consistency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Small</Label>
                  <Textarea size="medium" placeholder="Small textarea..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Medium</Label>
                  <Textarea size="medium" placeholder="Medium textarea..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Large</Label>
                  <Textarea size="medium" placeholder="Large textarea..." />
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
                  <h4 className="font-medium mb-1">Small (min-h-[80px])</h4>
                  <p className="text-sm text-muted-foreground">
                    Short descriptions, comments, brief notes
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Medium (min-h-[100px]) - Default</h4>
                  <p className="text-sm text-muted-foreground">
                    Standard descriptions, most common use case
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Large (min-h-[120px])</h4>
                  <p className="text-sm text-muted-foreground">
                    Long descriptions, detailed content, rich text
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
                    Every textarea should have a clear, descriptive label
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Provide Placeholders</h4>
                  <p className="text-sm text-muted-foreground">
                    Use placeholders to guide users on what to enter
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Consider Resize</h4>
                  <p className="text-sm text-muted-foreground">
                    Textareas can be resized by users, but set appropriate min-height
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

