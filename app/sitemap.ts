import { MetadataRoute } from "next";
import { makeBlogService } from "@/src/application/blog/blog.factory";

/**
 * Sitemap configuration
 *
 * Generates XML sitemap for search engines with all public pages
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com";
  const currentDate = new Date();
  const blogService = makeBlogService();
  const posts = await blogService.getAllPosts();

  const blogEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.dateModified
        ? new Date(post.dateModified + (post.dateModified.includes("T") ? "" : "T12:00:00Z"))
        : new Date(post.datePublished + (post.datePublished.includes("T") ? "" : "T12:00:00Z")),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // Public pages that should be indexed
  const publicPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/signup`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...blogEntries,
  ];

  return publicPages;
}

