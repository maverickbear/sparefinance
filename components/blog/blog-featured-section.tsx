import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import type { BlogPostListItem } from "@/src/domain/blog/blog.types";

interface BlogFeaturedSectionProps {
  post: BlogPostListItem;
}

function parseDate(dateStr: string): Date {
  return dateStr.includes("T")
    ? new Date(dateStr)
    : new Date(dateStr + "T12:00:00Z");
}

export function BlogFeaturedSection({ post }: BlogFeaturedSectionProps) {
  const date = parseDate(post.datePublished);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Link href={`/blog/${post.slug}`} className="group block md:flex">
        <div className="relative aspect-[16/10] w-full shrink-0 md:aspect-auto md:w-1/2 md:max-w-[55%]">
          {post.image ? (
            <Image
              src={post.image.src}
              alt={post.image.alt}
              width={post.image.width ?? 800}
              height={post.image.height ?? 500}
              className="h-full object-cover transition-opacity group-hover:opacity-95"
              sizes="(max-width: 768px) 100vw, 55vw"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
        </div>
        <div className="flex flex-col justify-center p-6 md:p-8 lg:p-10">
          <div className="mb-3 flex flex-nowrap justify-start items-start gap-2">
            {(post.tags ?? []).map((tag, i) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i % 2 === 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {tag}
              </span>
            ))}
            <time
              dateTime={post.datePublished}
              className="text-sm text-muted-foreground ml-auto w-full"
            >
              {format(date, "d MMM yyyy")}
            </time>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl mb-3 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed line-clamp-2 mb-4">
            {post.description}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Read article
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </Link>
    </article>
  );
}
