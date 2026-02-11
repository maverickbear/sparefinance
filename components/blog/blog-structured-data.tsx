/**
 * Blog JSON-LD structured data for SEO (Schema.org).
 * List page: Blog / CollectionPage. Post page: BlogPosting.
 */

import type { BlogPost, BlogPostListItem } from "@/src/domain/blog/blog.types";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com";

interface BlogListStructuredDataProps {
  posts: BlogPostListItem[];
}

export function BlogListStructuredData({ posts }: BlogListStructuredDataProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Spare Finance Blog",
    description:
      "Practical personal finance articles: budgeting, expense tracking, saving, and financial peace.",
    url: `${BASE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Spare Finance",
      url: BASE_URL,
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      name: p.title,
      description: p.description,
      url: `${BASE_URL}/blog/${p.slug}`,
      datePublished: p.datePublished,
      dateModified: p.dateModified ?? p.datePublished,
      author: {
        "@type": "Person",
        name: p.author,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BlogPostStructuredDataProps {
  post: BlogPost;
}

export function BlogPostStructuredData({ post }: BlogPostStructuredDataProps) {
  const url = `${BASE_URL}/blog/${post.slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Spare Finance",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon-512x512.png`,
      },
    },
    ...(post.image && {
      image: {
        "@type": "ImageObject",
        url: post.image.src.startsWith("http") ? post.image.src : `${BASE_URL}${post.image.src}`,
        width: post.image.width,
        height: post.image.height,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
