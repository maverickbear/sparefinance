import type { BlogPost } from "@/src/domain/blog/blog.types";
import { format } from "date-fns";
import Image from "next/image";

interface BlogPostHeroProps {
  post: BlogPost;
}

/**
 * Hero section for the blog post detail page. Shows the main image with
 * optional overlay and title/metadata. Renders nothing if the post has no image.
 */
export function BlogPostHero({ post }: BlogPostHeroProps) {
  if (!post.image?.src) return null;

  const publishedDate = post.datePublished.includes("T")
    ? new Date(post.datePublished)
    : new Date(post.datePublished + "T12:00:00Z");

  return (
    <section
      className="relative w-full aspect-[21/9] min-h-[200px] md:min-h-[280px] overflow-hidden rounded-xl mb-8"
      aria-label="Article hero"
    >
      <Image
        src={post.image.src}
        alt={post.image.alt || post.title}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 1024px) 100vw, 1024px"
      />
      {/* Bottom gradient for text readability */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/20 to-transparent pointer-events-none"
        aria-hidden
      />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-primary-foreground">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight drop-shadow-sm max-w-3xl">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-primary-foreground/90">
          <span>{post.author}</span>
          <time dateTime={post.datePublished}>
            {format(publishedDate, "MMMM d, yyyy")}
          </time>
        </div>
      </div>
    </section>
  );
}
