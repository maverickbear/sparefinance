"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Plus, Trash2, Settings, Download } from "lucide-react";

export default function ButtonsPage() {
  return (
    <div className="w-full">
      <div className="p-4 lg:p-8 space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Buttons</h1>
          <p className="text-muted-foreground">
            Button component with different variants, sizes, and states used throughout the system
          </p>
        </div>
        {/* Variants */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default */}
            <Card>
              <CardHeader>
                <CardTitle>Default</CardTitle>
                <CardDescription>Primary button for main actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="default">Default</Button>
                  <Button variant="default" size="small">Small</Button>
                  <Button variant="default" size="medium">Medium</Button>
                  <Button variant="default" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="default">Default</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Destructive */}
            <Card>
              <CardHeader>
                <CardTitle>Destructive</CardTitle>
                <CardDescription>For dangerous or destructive actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="destructive">Delete</Button>
                  <Button variant="destructive" size="small">Small</Button>
                  <Button variant="destructive" size="medium">Medium</Button>
                  <Button variant="destructive" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="destructive">Delete</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Destructive Light */}
            <Card>
              <CardHeader>
                <CardTitle>Destructive Light</CardTitle>
                <CardDescription>Subtle destructive action button</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="destructive-light">Remove</Button>
                  <Button variant="destructive-light" size="small">Small</Button>
                  <Button variant="destructive-light" size="medium">Medium</Button>
                  <Button variant="destructive-light" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="destructive-light">Remove</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Outline */}
            <Card>
              <CardHeader>
                <CardTitle>Outline</CardTitle>
                <CardDescription>Secondary action with border</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline">Outline</Button>
                  <Button variant="outline" size="small">Small</Button>
                  <Button variant="outline" size="medium">Medium</Button>
                  <Button variant="outline" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="outline">Outline</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Secondary */}
            <Card>
              <CardHeader>
                <CardTitle>Secondary</CardTitle>
                <CardDescription>Secondary background button</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="secondary" size="small">Small</Button>
                  <Button variant="secondary" size="medium">Medium</Button>
                  <Button variant="secondary" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="secondary">Secondary</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Ghost */}
            <Card>
              <CardHeader>
                <CardTitle>Ghost</CardTitle>
                <CardDescription>Minimal button with hover effect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="ghost" size="small">Small</Button>
                  <Button variant="ghost" size="medium">Medium</Button>
                  <Button variant="ghost" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="ghost">Ghost</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Link */}
            <Card>
              <CardHeader>
                <CardTitle>Link</CardTitle>
                <CardDescription>Text link style button</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="link">Link</Button>
                  <Button variant="link" size="small">Small</Button>
                  <Button variant="link" size="medium">Medium</Button>
                  <Button variant="link" size="large">Large</Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    {`<Button variant="link">Link</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Sizes */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Sizes</h2>
          <Card>
            <CardHeader>
              <CardTitle>All Sizes</CardTitle>
              <CardDescription>Button size variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20">Tiny:</span>
                  <Button variant="default" size="tiny">Tiny Button</Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20">Small:</span>
                  <Button variant="default" size="small">Small Button</Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20">Medium:</span>
                  <Button variant="default" size="medium">Medium Button</Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20">Large:</span>
                  <Button variant="default" size="large">Large Button</Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20">Icon:</span>
                  <Button variant="default" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* States */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">States</h2>
          <Card>
            <CardHeader>
              <CardTitle>Button States</CardTitle>
              <CardDescription>Normal, disabled, and loading states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Normal State</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="default">Normal</Button>
                    <Button variant="outline">Normal Outline</Button>
                    <Button variant="secondary">Normal Secondary</Button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Disabled State</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="default" disabled>Disabled</Button>
                    <Button variant="outline" disabled>Disabled Outline</Button>
                    <Button variant="destructive" disabled>Disabled Destructive</Button>
                    <Button variant="ghost" disabled>Disabled Ghost</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* With Icons */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">With Icons</h2>
          <Card>
            <CardHeader>
              <CardTitle>Buttons with Icons</CardTitle>
              <CardDescription>Examples of buttons with icons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="default">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button variant="ghost">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
                <Button variant="link">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Landing Page Styles */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Landing Page Styles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Hero CTA Button</CardTitle>
                <CardDescription>Primary call-to-action from landing page hero</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="bg-white dark:bg-black text-foreground dark:text-white hover:bg-white/90 dark:hover:bg-black/90 text-lg font-semibold px-10 h-14 rounded-full transition-all shadow-lg hover:shadow-xl"
                  >
                    <Link href="#">
                      Start your 30-day free trial
                    </Link>
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Button
  asChild
  className="bg-white dark:bg-black text-foreground 
    dark:text-white hover:bg-white/90 dark:hover:bg-black/90 
    text-lg font-semibold px-10 h-14 rounded-full 
    transition-all shadow-lg hover:shadow-xl"
>
  <Link href="/auth/signup">
    Start your 30-day free trial
  </Link>
</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Footer CTA Button</CardTitle>
                <CardDescription>Call-to-action from landing page footer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="bg-primary text-black hover:bg-primary/90 text-lg font-semibold px-10 h-14 rounded-full"
                  >
                    <Link href="#">
                      Start Organizing Your Finances
                    </Link>
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Button
  asChild
  className="bg-primary text-black hover:bg-primary/90 
    text-lg font-semibold px-10 h-14 rounded-full"
>
  <Link href="/auth/signup">
    Start Organizing Your Finances
  </Link>
</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outline with Backdrop</CardTitle>
                <CardDescription>Hero secondary button with backdrop blur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="bg-white/10 border-foreground/30 text-foreground hover:bg-white/20 text-lg font-medium px-8 h-12 rounded-full backdrop-blur-sm"
                  >
                    <Link href="#">
                      Learn More
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Button
  asChild
  variant="outline"
  className="bg-white/10 border-foreground/30 
    text-foreground hover:bg-white/20 text-lg 
    font-medium px-8 h-12 rounded-full backdrop-blur-sm"
>
  <Link href="#features">
    Learn More
    <ArrowRight className="ml-2 w-5 h-5" />
  </Link>
</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Header Navigation Button</CardTitle>
                <CardDescription>Ghost button used in landing page header</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    variant="ghost"
                    size="small"
                    className="text-foreground hover:text-foreground/80 hover:bg-black/20 dark:hover:bg-black/20 border border-transparent hover:border-foreground/20 text-sm"
                  >
                    <Link href="#">Sign In</Link>
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Button
  asChild
  variant="ghost"
  size="small"
  className="text-foreground hover:text-foreground/80 
    hover:bg-black/20 dark:hover:bg-black/20 
    border border-transparent hover:border-foreground/20 text-sm"
>
  <Link href="/auth/login">Sign In</Link>
</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mobile Footer Buttons</CardTitle>
                <CardDescription>Buttons used in mobile footer navigation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Button
                      asChild
                      variant="ghost"
                      className="flex-1"
                    >
                      <Link href="#">Sign In</Link>
                    </Button>
                    <Button
                      asChild
                      className="flex-1 font-semibold bg-primary-scale-500 text-foreground hover:bg-primary-scale-600"
                    >
                      <Link href="#">Get Started</Link>
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      asChild
                      className="flex-1 bg-primary text-black hover:bg-primary/90"
                    >
                      <Link href="#">Dashboard</Link>
                    </Button>
                  </div>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`{/* Sign In + Get Started */}
<div className="flex gap-3">
  <Button
    asChild
    variant="ghost"
    className="flex-1"
  >
    <Link href="/auth/login">Sign In</Link>
  </Button>
  <Button
    asChild
    className="flex-1 font-semibold bg-primary-scale-500 
      text-foreground hover:bg-primary-scale-600"
  >
    <Link href="/auth/signup">Get Started</Link>
  </Button>
</div>

{/* Dashboard (when authenticated) */}
<Button
  asChild
  className="flex-1 bg-primary text-black hover:bg-primary/90"
>
  <Link href="/dashboard">Dashboard</Link>
</Button>`}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Usage Guidelines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>When to Use Each Variant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Default</h4>
                  <p className="text-sm text-muted-foreground">
                    Primary actions, main CTAs, form submissions
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Outline</h4>
                  <p className="text-sm text-muted-foreground">
                    Secondary actions, cancel buttons, alternative options
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Ghost</h4>
                  <p className="text-sm text-muted-foreground">
                    Tertiary actions, navigation, less prominent actions
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Destructive</h4>
                  <p className="text-sm text-muted-foreground">
                    Delete, remove, or destructive actions
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Link</h4>
                  <p className="text-sm text-muted-foreground">
                    Text links, learn more, additional information
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Size Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Small</h4>
                  <p className="text-sm text-muted-foreground">
                    Compact spaces, tables, secondary actions
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Medium (Default)</h4>
                  <p className="text-sm text-muted-foreground">
                    Standard buttons, most common use case
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Large</h4>
                  <p className="text-sm text-muted-foreground">
                    Hero sections, prominent CTAs, important actions
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Icon</h4>
                  <p className="text-sm text-muted-foreground">
                    Icon-only buttons, toolbars, compact UI
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

