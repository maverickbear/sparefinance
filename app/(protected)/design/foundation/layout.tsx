"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { PageHeader } from "@/components/common/page-header";

export default function FoundationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (pathname.includes("/colors")) return "colors";
    if (pathname.includes("/typography")) return "typography";
    if (pathname.includes("/spacing")) return "spacing";
    if (pathname.includes("/logos")) return "logos";
    return "colors";
  };

  const activeTab = getActiveTab();

  const handleTabChange = (value: string) => {
    router.push(`/design/foundation/${value}`);
  };

  return (
    <div className="w-full">
      <PageHeader 
        title="Foundation" 
        description="Core design tokens and building blocks"
      />
      
      <SimpleTabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Desktop Tabs */}
        <div className="hidden lg:block border-b">
          <div className="px-4 lg:px-8">
            <SimpleTabsList>
              <SimpleTabsTrigger value="colors">Colors</SimpleTabsTrigger>
              <SimpleTabsTrigger value="typography">Typography</SimpleTabsTrigger>
              <SimpleTabsTrigger value="spacing">Spacing</SimpleTabsTrigger>
              <SimpleTabsTrigger value="logos">Logos</SimpleTabsTrigger>
            </SimpleTabsList>
          </div>
        </div>

        {/* Mobile/Tablet Tabs - Sticky at top */}
        <div className="lg:hidden sticky top-0 z-40 bg-card border-b">
          <div 
            className="overflow-x-auto scrollbar-hide" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              touchAction: 'pan-x',
            }}
          >
            <SimpleTabsList className="min-w-max px-4" style={{ scrollSnapAlign: 'start' }}>
              <SimpleTabsTrigger value="colors" className="flex-shrink-0 whitespace-nowrap">
                Colors
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="typography" className="flex-shrink-0 whitespace-nowrap">
                Typography
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="spacing" className="flex-shrink-0 whitespace-nowrap">
                Spacing
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="logos" className="flex-shrink-0 whitespace-nowrap">
                Logos
              </SimpleTabsTrigger>
            </SimpleTabsList>
          </div>
        </div>

        {/* Content */}
        <div className="w-full">
          {children}
        </div>
      </SimpleTabs>
    </div>
  );
}

