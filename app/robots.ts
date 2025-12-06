import { MetadataRoute } from "next";

/**
 * Robots.txt configuration
 * 
 * Controls how search engine crawlers access and index the site
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/faq",
          "/terms-of-service",
          "/privacy-policy",
          "/auth/signup",
          "/auth/login",
        ],
        disallow: [
          "/dashboard",
          "/api",
          "/transactions",
          "/accounts",
          "/investments",
          "/reports",
          "/insights",
          "/planning",
          "/banking",
          "/members",
          "/subscription",
          "/account-blocked",
          "/account-deleted",
          "/maintenance",
          "/welcome",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/faq",
          "/terms-of-service",
          "/privacy-policy",
        ],
        disallow: [
          "/dashboard",
          "/api",
          "/transactions",
          "/accounts",
          "/investments",
          "/reports",
          "/insights",
          "/planning",
          "/banking",
          "/members",
          "/subscription",
          "/account-blocked",
          "/account-deleted",
          "/maintenance",
          "/welcome",
        ],
        crawlDelay: 0,
      },
      {
        userAgent: "Bingbot",
        allow: [
          "/",
          "/faq",
          "/terms-of-service",
          "/privacy-policy",
        ],
        disallow: [
          "/dashboard",
          "/api",
          "/transactions",
          "/accounts",
          "/investments",
          "/reports",
          "/insights",
          "/planning",
          "/banking",
          "/members",
          "/subscription",
          "/account-blocked",
          "/account-deleted",
          "/maintenance",
          "/welcome",
        ],
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

