"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Type, Move, Image as ImageIcon, Layout, Component, MousePointer2, FileText, List, Square } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";

const designCategories = [
  {
    title: "Foundation",
    description: "Core design tokens and building blocks",
    icon: Layout,
    color: "bg-primary/10 text-primary border-primary/20",
    items: [
      {
        title: "Colors",
        description: "Color system and tokens",
        href: "/design/foundation/colors",
        icon: Palette,
        disabled: false,
      },
      {
        title: "Typography",
        description: "Font families, sizes, and styles",
        href: "/design/foundation/typography",
        icon: Type,
        disabled: false,
      },
      {
        title: "Spacing",
        description: "Spacing scale and layout tokens",
        href: "/design/foundation/spacing",
        icon: Move,
        disabled: false,
      },
      {
        title: "Logos",
        description: "Brand logos and assets",
        href: "/design/foundation/logos",
        icon: ImageIcon,
        disabled: false,
      },
    ],
  },
  {
    title: "Components",
    description: "UI components and patterns",
    icon: Component,
    color: "bg-accent/10 text-accent-foreground border-accent/20",
    items: [
      {
        title: "Buttons",
        description: "Button variants, sizes, and states",
        href: "/design/components/buttons",
        icon: MousePointer2,
        disabled: false,
      },
      {
        title: "Inputs",
        description: "Input fields with different sizes and types",
        href: "/design/components/inputs",
        icon: Square,
        disabled: false,
      },
      {
        title: "Textareas",
        description: "Textarea components with size variants",
        href: "/design/components/textareas",
        icon: FileText,
        disabled: false,
      },
      {
        title: "Selects",
        description: "Select dropdowns with size variants",
        href: "/design/components/selects",
        icon: List,
        disabled: false,
      },
    ],
  },
];

export default function DesignPage() {
  return (
    <div className="w-full">
      <PageHeader 
        title="Design System" 
        description="Documentation and guidelines for the Spare Finance design system"
      />
      
      <div className="p-4 lg:p-8 space-y-8">
        {designCategories.map((category) => (
          <div key={category.title} className="space-y-4">
            <div className="flex items-center gap-3">
              <category.icon className="w-6 h-6 text-foreground" />
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{category.title}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {category.items.map((item) => {
                const CardWrapper = item.disabled ? "div" : Link;
                const wrapperProps = item.disabled 
                  ? {} 
                  : { href: item.href, className: "block" };
                
                return (
                  <CardWrapper key={item.title} {...(wrapperProps as any)}>
                    <Card 
                      className={`
                        h-full transition-all cursor-pointer
                        ${item.disabled 
                          ? "opacity-50 cursor-not-allowed" 
                          : "hover:shadow-md hover:border-primary/40"
                        }
                        ${category.color}
                      `}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <item.icon className="w-5 h-5" />
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                        </div>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                      {item.disabled && (
                        <CardContent>
                          <p className="text-xs text-muted-foreground">Coming soon</p>
                        </CardContent>
                      )}
                    </Card>
                  </CardWrapper>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

