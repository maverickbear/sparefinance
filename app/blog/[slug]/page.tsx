import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { makeBlogService } from "@/src/application/blog/blog.factory";
import { BlogPostContent } from "@/components/blog/blog-post-content";
import { BlogPostHero } from "@/components/blog/blog-post-hero";
import { BlogPostStructuredData } from "@/components/blog/blog-structured-data";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const blogService = makeBlogService();
  const slugs = await blogService.getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const blogService = makeBlogService();
  const post = await blogService.getPostBySlug(slug);
  if (!post) {
    return { title: "Post not found" };
  }
  const url = `${BASE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} | Spare Finance Blog`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      authors: [post.author],
      siteName: "Spare Finance",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    ...(post.keywords?.length && { keywords: post.keywords }),
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const blogService = makeBlogService();
  const post = await blogService.getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <BlogPostStructuredData post={post} />
      <BlogPostHero post={post} />
      <BlogPostContent post={post} />
    </div>
  );
}
