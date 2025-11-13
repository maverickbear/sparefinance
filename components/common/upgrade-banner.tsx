"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserClient } from "@/lib/api/user-client";

interface UserData {
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  plan: {
    name: "free" | "basic" | "premium";
  } | null;
  subscription?: {
    status: "active" | "trialing" | "cancelled" | "past_due";
    trialEndDate?: string | null;
    trialStartDate?: string | null;
  } | null;
}

export function UpgradeBanner() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerHeight, setBannerHeight] = useState(88);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await getUserClient();
        setUserData(data);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchUserData();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  // Check if subscription is cancelled or past due
  const isSubscriptionInactive = userData?.subscription?.status === "cancelled" || userData?.subscription?.status === "past_due";

  // Calculate banner height and update CSS variable
  useEffect(() => {
    if (loading || !userData || userData.plan?.name === "premium" || userData.subscription?.status === "trialing" || userData.subscription?.status === "active") {
      // Banner is not visible, dispatch event to notify
      window.dispatchEvent(new CustomEvent('banner-visibility-changed', { detail: { visible: false } }));
      return;
    }

    const updateBannerHeight = () => {
      const banner = document.getElementById('upgrade-banner');
      if (banner) {
        const height = banner.offsetHeight;
        setBannerHeight(height);
        document.documentElement.style.setProperty('--banner-height', `${height}px`);
        // Dispatch event to notify that banner is now visible
        window.dispatchEvent(new CustomEvent('banner-visibility-changed', { detail: { visible: true, height } }));
      }
    };

    // Initial calculation with multiple delays to ensure DOM is ready
    setTimeout(updateBannerHeight, 0);
    setTimeout(updateBannerHeight, 100);
    setTimeout(updateBannerHeight, 300);
    setTimeout(updateBannerHeight, 500);

    // Update on resize
    window.addEventListener('resize', updateBannerHeight);
    
    // Use ResizeObserver for more accurate height tracking
    const banner = document.getElementById('upgrade-banner');
    if (banner) {
      const resizeObserver = new ResizeObserver(() => {
        updateBannerHeight();
      });
      resizeObserver.observe(banner);
      
      return () => {
        window.removeEventListener('resize', updateBannerHeight);
        resizeObserver.disconnect();
      };
    }
    
    return () => {
      window.removeEventListener('resize', updateBannerHeight);
    };
  }, [loading, userData]);

  // Only show banner if not premium, not in trial, not active, and has subscription data
  if (loading) {
    return null;
  }
  
  if (!userData || userData.plan?.name === "premium" || userData.subscription?.status === "trialing" || userData.subscription?.status === "active") {
    return null;
  }

  return (
    <div className="w-full bg-primary border-b border-primary/20" id="upgrade-banner">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Rocket className="h-5 w-5 text-primary-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-primary-foreground mb-1">
                {isSubscriptionInactive
                  ? "Reactivate Your Subscription"
                  : userData?.plan?.name === "free" 
                  ? "Free to Basic"
                  : "Basic to Premium"}
              </div>
              <p className="text-sm text-primary-foreground leading-relaxed">
                {isSubscriptionInactive
                  ? "Choose a plan and regain full access to all features and bank integrations."
                  : userData?.plan?.name === "free" 
                  ? "Upgrade to Basic and enjoy smarter tools and deeper insights."
                  : "Upgrade to Premium and unlock advanced features and priority support."}
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="secondary"
            size="small"
            className="flex-shrink-0"
          >
            <Link href={isSubscriptionInactive ? "/pricing" : "/dashboard"}>
              {isSubscriptionInactive ? "Renew Plan" : "Learn More"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

