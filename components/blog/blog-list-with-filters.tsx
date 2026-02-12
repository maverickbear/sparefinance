"use client";

import { useMemo, useState } from "react";
import { BlogFeaturedSection } from "./blog-featured-section";
import { BlogGridCard } from "./blog-grid-card";
import { BlogHeroBanner } from "./blog-hero-banner";
import type { BlogPostListItem } from "@/src/domain/blog/blog.types";

interface BlogListWithFiltersProps {
  posts: BlogPostListItem[];
  allTags: string[];
}

function matchesSearch(post: BlogPostListItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    post.title.toLowerCase().includes(q) ||
    post.description.toLowerCase().includes(q) ||
    (post.tags ?? []).some((t) => t.toLowerCase().includes(q))
  );
}

function matchesTag(post: BlogPostListItem, tag: string | null): boolean {
  if (!tag) return true;
  return (post.tags ?? []).includes(tag);
}

export function BlogListWithFilters({ posts, allTags }: BlogListWithFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return posts.filter(
      (p) => matchesSearch(p, searchQuery) && matchesTag(p, selectedTag)
    );
  }, [posts, searchQuery, selectedTag]);

  const featured = filtered[0] ?? null;
  const gridPosts = filtered.slice(1);

  return (
    <>
      <BlogHeroBanner
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        allTags={allTags}
      />

      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 md:py-12 space-y-10">
        {filtered.length === 0 ? (
          <section aria-label="Search results" className="py-12 text-center">
            <p className="text-muted-foreground">
              No articles found. Try a different term or clear the filter.
            </p>
          </section>
        ) : (
          <>
            {featured && (
              <section aria-label="Featured article">
                <BlogFeaturedSection post={featured} />
              </section>
            )}

            {gridPosts.length > 0 && (
              <section
                aria-label="More articles"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {gridPosts.map((post) => (
                  <BlogGridCard key={post.slug} post={post} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
