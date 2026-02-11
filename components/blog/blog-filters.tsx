"use client";

import { useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BlogFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
  allTags: string[];
  className?: string;
}

export function BlogFilters({
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagChange,
  allTags,
  className,
}: BlogFiltersProps) {
  const handleTagClick = useCallback(
    (tag: string) => {
      onTagChange(selectedTag === tag ? null : tag);
    },
    [selectedTag, onTagChange]
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Buscar artigos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 rounded-xl border-border bg-background"
          aria-label="Buscar artigos por título ou descrição"
        />
      </div>
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTagChange(null)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedTag === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Todos
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                selectedTag === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
