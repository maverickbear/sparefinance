import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { BlogPostListItem } from "@/src/domain/blog/blog.types";
import { format } from "date-fns";

interface BlogPostCardProps {
  post: BlogPostListItem;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const date = post.datePublished.includes("T")
    ? new Date(post.datePublished)
    : new Date(post.datePublished + "T12:00:00Z");

  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <Card className="h-full transition-colors border-border bg-card hover:border-primary/30 hover:bg-muted/30">
        <CardHeader className="pb-2">
          <time
            dateTime={post.datePublished}
            className="text-xs text-muted-foreground"
          >
            {format(date, "MMMM d, yyyy")}
          </time>
          <h2 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h2>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {post.author}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {post.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
