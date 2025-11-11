"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ParallaxFeatureProps {
  title: string;
  description: string;
  imageUrl?: string;
  icon?: React.ReactNode;
  demoComponent?: React.ReactNode;
  reverse?: boolean;
}

export function ParallaxFeature({
  title,
  description,
  imageUrl,
  icon,
  demoComponent,
  reverse = false,
}: ParallaxFeatureProps) {
  return (
    <div
      className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-8 md:gap-12 py-12 md:py-20`}
    >
      {/* Image/Visual Section */}
      <div className="flex-1 w-full md:w-1/2 relative">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[500px] flex items-center justify-center p-4 bg-primary">
          {demoComponent ? (
            <div className="w-full h-full flex items-center justify-center">
              {demoComponent}
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-8">
              {icon && <div className="mb-4 flex justify-center">{icon}</div>}
              <p className="text-muted-foreground text-sm">{title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 w-full md:w-1/2">
        <Card className="transition-colors">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-base md:text-lg">
              {description}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

