"use client";

interface ParallaxFeatureProps {
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  icon?: React.ReactNode;
  demoComponent?: React.ReactNode;
  reverse?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ParallaxFeature({
  title,
  subtitle,
  description,
  imageUrl,
  icon,
  demoComponent,
  reverse = false,
  isFirst = false,
  isLast = false,
}: ParallaxFeatureProps) {
  return (
    <div
      className={`relative ${
        reverse ? "bg-[#f5f5f7] dark:bg-[#1d1d1f]" : "bg-background"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex flex-col ${
            reverse ? "lg:flex-row-reverse" : "lg:flex-row"
          } items-center gap-12 lg:gap-20 py-20 lg:py-32`}
        >
          {/* Content Section - Apple Style */}
          <div className="flex-1 w-full lg:w-1/2">
            <div className="max-w-xl mx-auto lg:mx-0">
              {subtitle && (
                <p className="text-sm sm:text-base font-medium text-primary mb-3 tracking-wide uppercase">
                  {subtitle}
                </p>
              )}
              <h3 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 tracking-tight leading-tight">
                {title}
              </h3>
              <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground font-light leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Visual/Demo Section - Apple Style */}
          <div className="flex-1 w-full lg:w-1/2">
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden bg-[#4A4AF2] backdrop-blur-sm">
                <div className="aspect-video w-full flex items-center justify-center p-6 lg:p-8 min-h-[400px] lg:min-h-[600px]">
                  {demoComponent ? (
                    <div className="w-full h-full flex items-center justify-center scale-100 lg:scale-110">
                      {demoComponent}
                    </div>
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <div className="text-center p-8">
                      {icon && (
                        <div className="mb-4 flex justify-center">{icon}</div>
                      )}
                      <p className="text-muted-foreground text-sm">{title}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
