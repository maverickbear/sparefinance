"use client";

import { usePagePerformance } from "@/hooks/use-page-performance";
import { useEffect, useState } from "react";
import { CategoriesModule } from "@/src/presentation/components/features/categories/categories-module";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useWriteGuard } from "@/hooks/use-write-guard";

export default function CategoriesPage() {
  const perf = usePagePerformance("Settings - Categories");
  const { checkWriteAccess } = useWriteGuard();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  return (
    <div>
      <PageHeader
        title="Categories"
      >
        <Button
          onClick={() => {
            if (!checkWriteAccess()) return;
            setIsCreateDialogOpen(true);
          }}
          size="medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New
        </Button>
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        <CategoriesModule 
          isCreateDialogOpen={isCreateDialogOpen}
          onCreateDialogChange={setIsCreateDialogOpen}
        />
      </div>
    </div>
  );
}

