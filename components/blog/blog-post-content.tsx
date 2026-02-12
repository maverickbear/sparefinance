import type { BlogPost } from "@/src/domain/blog/blog.types";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlogPortableText } from "./blog-portable-text";

interface BlogPostContentProps {
  post: BlogPost;
}

/**
 * Renders a single blog post with semantic HTML (article, header, time, body).
 * Uses Portable Text when bodyBlocks is present (Sanity); otherwise falls back to plain body.
 */
export function BlogPostContent({ post }: BlogPostContentProps) {
  const publishedDate = post.datePublished.includes("T")
    ? new Date(post.datePublished)
    : new Date(post.datePublished + "T12:00:00Z");
  const modifiedDate = post.dateModified
    ? post.dateModified.includes("T")
      ? new Date(post.dateModified)
      : new Date(post.dateModified + "T12:00:00Z")
    : null;

  const hasRichBody = post.bodyBlocks && post.bodyBlocks.length > 0;
  const paragraphs = hasRichBody
    ? []
    : post.body
        .trim()
        .split(/\n\n+/)
        .filter(Boolean);

  const showHeader = !post.image;

  return (
    <article className="max-w-[65ch] mx-auto">
      {showHeader && (
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{post.author}</span>
            <time dateTime={post.datePublished}>
              {format(publishedDate, "MMMM d, yyyy")}
            </time>
            {modifiedDate && modifiedDate.getTime() !== publishedDate.getTime() && (
              <span>
                Updated {format(modifiedDate, "MMMM d, yyyy")}
              </span>
            )}
          </div>
        </header>
      )}
      <div className="prose prose-neutral dark:prose-invert prose-p:text-muted-foreground prose-p:leading-relaxed">
        {hasRichBody ? (
          <BlogPortableText value={post.bodyBlocks!} />
        ) : (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        )}
      </div>
      <footer className="mt-12 pt-8 border-t border-border">
        <p className="text-sm text-muted-foreground mb-4">
          Take control of your money in one place.
        </p>
        <Button asChild size="medium" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/auth/signup">Start your 30-day free trial</Link>
        </Button>
      </footer>
    </article>
  );
}
