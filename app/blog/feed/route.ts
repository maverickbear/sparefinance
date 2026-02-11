import { makeBlogService } from "@/src/application/blog/blog.factory";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822Date(dateStr: string): string {
  const d = dateStr.includes("T")
    ? new Date(dateStr)
    : new Date(dateStr + "T12:00:00Z");
  return d.toUTCString();
}

export async function GET() {
  const blogService = makeBlogService();
  const posts = blogService.getAllPosts();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Spare Finance Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Practical personal finance articles: budgeting, expense tracking, saving, and financial peace.</description>
    <language>en-us</language>
    <lastBuildDate>${toRfc822Date(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/feed" rel="self" type="application/rss+xml"/>
    ${posts
      .map(
        (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${toRfc822Date(post.datePublished)}</pubDate>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
    </item>`
      )
      .join("")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
