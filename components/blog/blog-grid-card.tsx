import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import type { BlogPostListItem } from "@/src/domain/blog/blog.types";

interface BlogGridCardProps {
  post: BlogPostListItem;
}

function parseDate(dateStr: string): Date {
  return dateStr.includes("T")
    ? new Date(dateStr)
    : new Date(dateStr + "T12:00:00Z");
}

export function BlogGridCard({ post }: BlogGridCardProps) {
  const displayDate = post.dateModified ?? post.datePublished;
  const date = parseDate(displayDate);

  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <article className="h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30 hover:shadow-md">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl">
          {post.image ? (
            <Image
              src={post.image.src}
              alt={post.image.alt}
              width={post.image.width ?? 600}
              height={post.image.height ?? 400}
              className="object-cover transition-transform group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
        </div>
        <div className="p-5">
          <div className="mb-2 flex flex-wrap gap-2">
            {(post.tags ?? []).map((tag, i) => (
              <span
                key={tag}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  i % 2 === 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {post.description}
          </p>
          <div className="flex items-center gap-3">
            {post.authorAvatar ? (
              <Image
                src={post.authorAvatar}
                alt=""
                width={32}
                height={32}
                className="rounded-full object-cover h-8 w-8"
              />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                aria-hidden
              >
                {post.author.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {post.author}
              </p>
              <p className="text-xs text-muted-foreground">
                Updated on: {format(date, "d MMM yyyy")}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
