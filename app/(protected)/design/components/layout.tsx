"use client";

import { usePathname, useRouter } from "next/navigation";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { PageHeader } from "@/components/common/page-header";

export default function ComponentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (pathname.includes("/buttons")) return "buttons";
    if (pathname.includes("/inputs")) return "inputs";
    if (pathname.includes("/textareas")) return "textareas";
    if (pathname.includes("/selects")) return "selects";
    return "buttons";
  };

  const activeTab = getActiveTab();

  const handleTabChange = (value: string) => {
    router.push(`/design/components/${value}`);
  };

  return (
    <div className="w-full">
      <PageHeader 
        title="Components" 
        description="UI components and patterns"
      />
      
      <SimpleTabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Desktop Tabs */}
        <div className="hidden lg:block border-b">
          <div className="px-4 lg:px-8">
            <SimpleTabsList>
              <SimpleTabsTrigger value="buttons">Buttons</SimpleTabsTrigger>
              <SimpleTabsTrigger value="inputs">Inputs</SimpleTabsTrigger>
              <SimpleTabsTrigger value="textareas">Textareas</SimpleTabsTrigger>
              <SimpleTabsTrigger value="selects">Selects</SimpleTabsTrigger>
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
              <SimpleTabsTrigger value="buttons" className="flex-shrink-0 whitespace-nowrap">
                Buttons
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="inputs" className="flex-shrink-0 whitespace-nowrap">
                Inputs
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="textareas" className="flex-shrink-0 whitespace-nowrap">
                Textareas
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="selects" className="flex-shrink-0 whitespace-nowrap">
                Selects
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

