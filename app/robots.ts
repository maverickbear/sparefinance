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
          "/budgets",
          "/goals",
          "/investments",
          "/reports",
          "/insights",
          "/planning",
          "/banking",
          "/billing",
          "/profile",
          "/members",
          "/subscription",
          "/account-blocked",
          "/account-deleted",
          "/maintenance",
          "/welcome",
          "/select-plan",
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
          "/budgets",
          "/goals",
          "/investments",
          "/reports",
          "/insights",
          "/planning",
          "/banking",
          "/billing",
          "/profile",
          "/members",
          "/subscription",
          "/account-blocked",
          "/account-deleted",
          "/maintenance",
          "/welcome",
          "/select-plan",
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
          "/budgets",
          "/goals",
          "/investments",
          "/reports",
          "/insights",
          "/planning",
          "/banking",
          "/billing",
          "/profile",
          "/members",
          "/subscription",
          "/account-blocked",
          "/account-deleted",
          "/maintenance",
          "/welcome",
          "/select-plan",
        ],
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

