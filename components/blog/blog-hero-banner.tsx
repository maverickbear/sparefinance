"use client";

import Image from "next/image";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BlogHeroBannerProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
  allTags: string[];
}

const HERO_IMAGE_SRC =
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920&q=80";

export function BlogHeroBanner({
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagChange,
  allTags,
}: BlogHeroBannerProps) {
  const handleTagClick = (tag: string) => {
    onTagChange(selectedTag === tag ? null : tag);
  };

  return (
    <section
      className="relative min-h-[320px] md:min-h-[400px] flex flex-col items-center justify-center overflow-hidden w-full px-4 sm:px-6 lg:px-8 pb-10 md:pb-14"
      aria-label="Blog hero"
    >
      {/* Background image */}
      <Image
        src={HERO_IMAGE_SRC}
        alt=""
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />

      {/* Overlay for readability */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/60 to-foreground/80"
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <BookOpen
            className="h-9 w-9 md:h-10 md:w-10 text-primary-foreground shrink-0"
            aria-hidden
          />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-foreground">
            Blog
          </h1>
        </div>
        <p className="text-primary-foreground/90 text-sm md:text-base max-w-xl">
          Practical tips and guides for personal finance: budgeting, tracking
          expenses, saving, and finding financial peace.
        </p>

        {/* Search in hero */}
        <div className="w-full max-w-md">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/70"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 rounded-xl border-primary-foreground/20 bg-background/95 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary-foreground/30"
              aria-label="Search articles by title or description"
            />
          </div>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => onTagChange(null)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                selectedTag === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/80 text-foreground hover:bg-background"
              )}
            >
              All
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
                    : "bg-background/80 text-foreground hover:bg-background"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
