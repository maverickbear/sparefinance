"use client";

import { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
import { profileSchema, ProfileFormData } from "@/src/domain/profile/profile.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, User, CreditCard, Upload, Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DeleteAccountSection } from "@/components/profile/delete-account-section";
import { HouseholdIncomeSettings } from "@/src/presentation/components/features/onboarding/household-income-settings";
import { useToast } from "@/components/toast-provider";
import { UsageChart } from "@/components/billing/usage-chart";
import { SubscriptionManagementEmbedded } from "@/components/billing/subscription-management-embedded";
import { PaymentMethodManager } from "@/components/billing/payment-method-manager";
import { Subscription, Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { LimitCheckResult } from "@/lib/api/subscription";
import { PageHeader } from "@/components/common/page-header";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger, SimpleTabsContent } from "@/components/ui/simple-tabs";
// OPTIMIZED: Use shared billing cache from lib/api/billing-cache.ts
// This cache is shared across the entire application to prevent duplicate API calls
import { billingDataCache, getBillingCacheData, getOrCreateBillingPromise, invalidateBillingCache } from "@/lib/api/billing-cache";

// Lazy load PaymentHistory to improve initial load time
const PaymentHistory = lazy(() => 
  import("@/components/billing/payment-history").then(m => ({ default: m.PaymentHistory }))
);

function LazyPaymentHistory() {
  return (
    <Suspense fallback={
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    }>
      <PaymentHistory />
    </Suspense>
  );
}

// Profile interfaces
interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  plan?: {
    name: "essential" | "pro";
    isShadow: boolean;
    ownerId?: string;
    ownerName?: string;
  } | null;
  household?: {
    isOwner: boolean;
    isMember: boolean;
    ownerId?: string;
    ownerName?: string;
  } | null;
}


// Global cache for profile data (shared across all instances)
const profileDataCache = {
  data: null as Profile | null,
  promise: null as Promise<Profile | null> | null,
  timestamp: 0,
  TTL: 5 * 60 * 1000, // 5 minutes cache
};

// Expose cache for preloading during login
if (typeof window !== 'undefined') {
  (window as any).profileDataCache = profileDataCache;
}

// Profile Module Component
function ProfileModule() {
  // Check cache immediately to avoid showing skeleton if data is already available
  const hasCachedData = profileDataCache.data && 
    (Date.now() - profileDataCache.timestamp) < profileDataCache.TTL;
  
  const [profile, setProfile] = useState<Profile | null>(hasCachedData ? profileDataCache.data : null);
  const [loading, setLoading] = useState(!hasCachedData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: hasCachedData ? (profileDataCache.data?.name || "") : "",
      avatarUrl: hasCachedData ? (profileDataCache.data?.avatarUrl || "") : "",
      phoneNumber: hasCachedData ? (profileDataCache.data?.phoneNumber || "") : "",
    },
  });

  useEffect(() => {
    // If we have cached data, set form values immediately and skip loading
    if (hasCachedData && profileDataCache.data) {
      form.reset({
        name: profileDataCache.data.name || "",
        avatarUrl: profileDataCache.data.avatarUrl || "",
        phoneNumber: profileDataCache.data.phoneNumber || "",
      });
      // Still call loadProfile in background to refresh if needed, but don't show loading
      loadProfile();
    } else {
      // No cached data, load normally
      loadProfile();
    }
  }, []);

  async function loadProfile(force = false) {
    // Check cache first (unless forced)
    if (!force) {
      const now = Date.now();
      if (profileDataCache.data && (now - profileDataCache.timestamp) < profileDataCache.TTL) {
        // Use cached data - don't change loading state if we already have data
        const cached = profileDataCache.data;
        setProfile(cached);
        form.reset({
          name: cached.name || "",
          avatarUrl: cached.avatarUrl || "",
          phoneNumber: cached.phoneNumber || "",
        });
        // Only set loading to false if it was true (don't change if already false)
        setLoading(false);
        return;
      }

      // Reuse in-flight request if exists
      if (profileDataCache.promise) {
        try {
          // Only show loading if we don't have cached data
          const hasValidCache = profileDataCache.data && 
            (Date.now() - profileDataCache.timestamp) < profileDataCache.TTL;
          if (!hasValidCache) {
            setLoading(true);
          }
          const result = await profileDataCache.promise;
          if (result) {
            setProfile(result);
            form.reset({
              name: result.name || "",
              avatarUrl: result.avatarUrl || "",
              phoneNumber: result.phoneNumber || "",
            });
          }
          setLoading(false);
          return;
        } catch (error) {
          // If promise failed, continue to fetch new data
          console.error("Cached promise failed:", error);
        }
      }
    }

    try {
      // Only show loading if we don't have cached data
      const hasValidCache = profileDataCache.data && 
        (Date.now() - profileDataCache.timestamp) < profileDataCache.TTL;
      if (!hasValidCache) {
        setLoading(true);
      }
      
      // Create fetch promise and cache it
      const fetchPromise = (async () => {
        const response = await fetch("/api/v2/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        const profileData = await response.json();
        
        // Update cache
        if (profileData) {
          profileDataCache.data = profileData;
          profileDataCache.timestamp = Date.now();
        }
        profileDataCache.promise = null;
        
        return profileData;
      })();

      // Cache the promise
      profileDataCache.promise = fetchPromise;

      const profileData = await fetchPromise;

      if (profileData) {
        setProfile(profileData);
        form.reset({
          name: profileData.name || "",
          avatarUrl: profileData.avatarUrl || "",
          phoneNumber: profileData.phoneNumber || "",
        });
      } else {
        const defaultProfile: Profile = {
          name: "",
          email: "",
          avatarUrl: "",
          phoneNumber: "",
          dateOfBirth: "",
        };
        setProfile(defaultProfile);
        form.reset({
          name: "",
          avatarUrl: "",
          phoneNumber: "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      const defaultProfile: Profile = {
        name: "",
        email: "",
        avatarUrl: "",
        phoneNumber: "",
        dateOfBirth: "",
      };
      setProfile(defaultProfile);
      form.reset({
        name: "",
        avatarUrl: "",
        phoneNumber: "",
      });
      profileDataCache.promise = null;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: ProfileFormData) {
    try {
      setSaving(true);
      const response = await fetch("/api/v2/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      
      // Update cache after successful save
      profileDataCache.data = updatedProfile;
      profileDataCache.timestamp = Date.now();
      profileDataCache.promise = null;
      
      const successEvent = new CustomEvent("profile-saved", { detail: updatedProfile });
      window.dispatchEvent(successEvent);
      toast({ title: "Success", description: "Profile updated successfully", variant: "success" });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }

  function getAvatarUrl() {
    const avatarUrl = form.watch("avatarUrl") || profile?.avatarUrl;
    if (avatarUrl) {
      return avatarUrl;
    }
    return null;
  }

  function getInitials(name: string) {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please upload an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Please upload an image smaller than 5MB", variant: "destructive" });
      return;
    }

    try {
      setUploading(true);

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Upload to Supabase Storage
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload avatar";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await res.text();
            errorMessage = text || errorMessage;
          } catch (textError) {
            // If all else fails, use status text
            errorMessage = res.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const { url } = await res.json().catch(() => {
        throw new Error("Failed to parse response from server");
      });

      // Update form with new avatar URL
      form.setValue("avatarUrl", url);
      
      // Save avatar URL to profile automatically
      try {
        const response = await fetch("/api/v2/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ avatarUrl: url }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update profile");
        }

        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        
        // Update cache after successful avatar update
        profileDataCache.data = updatedProfile;
        profileDataCache.timestamp = Date.now();
        profileDataCache.promise = null;
        
        // Dispatch event to notify other components
        const successEvent = new CustomEvent("profile-saved", { detail: updatedProfile });
        window.dispatchEvent(successEvent);
      } catch (error) {
        console.error("Error saving avatar URL:", error);
        // Still show success for upload, but warn about save
        toast({ 
          title: "Uploaded", 
          description: "Avatar uploaded but failed to save. Please save your profile.", 
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: "Success", description: "Avatar uploaded and saved successfully", variant: "success" });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // Show skeleton while loading and no profile data
  if (loading && !profile) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <CardTitle className="text-base sm:text-lg">Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6">
            <div className="flex flex-col items-center sm:items-start space-y-2">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="h-9 bg-muted rounded animate-pulse" />
              <div className="h-9 bg-muted rounded animate-pulse" />
              <div className="h-9 bg-muted rounded animate-pulse" />
              <div className="h-9 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <CardTitle className="text-base sm:text-lg">Profile</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={form.handleSubmit(onSubmit as (data: ProfileFormData) => Promise<void>)}>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6">
            {/* Avatar Section - Left Side */}
            <div className="flex flex-col items-center sm:items-start space-y-2">
              <div className="relative">
                {getAvatarUrl() ? (
                  <img
                    src={getAvatarUrl()!}
                    alt="Profile"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const initialsContainer = e.currentTarget.nextElementSibling;
                      if (initialsContainer) {
                        (initialsContainer as HTMLElement).style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base sm:text-lg font-semibold border-2 ${
                    getAvatarUrl() ? "hidden" : "flex"
                  }`}
                >
                  {getInitials(form.watch("name") || profile?.name || "User")}
                </div>
              </div>
              
              <div className="flex flex-col items-center sm:items-start space-y-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  ref={fileInputRef}
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-3 w-3" />
                  {uploading ? "Uploading..." : "Upload Avatar"}
                </Button>
                <p className="text-xs text-muted-foreground text-center sm:text-left">
                  JPG, PNG or GIF. Max size 5MB
                </p>
              </div>
            </div>

            {/* Form Fields Section - Right Side */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input {...form.register("name")} id="name" size="medium" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ""}
                    readOnly
                    disabled
                    size="medium"
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    {...form.register("phoneNumber")}
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    size="medium"
                  />
                  {form.formState.errors.phoneNumber && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.phoneNumber.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="text"
                    value={profile?.dateOfBirth || ""}
                    readOnly
                    disabled
                    size="medium"
                    className="bg-muted"
                    placeholder="Not set"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button type="submit" size="small" disabled={saving} className="w-full sm:w-auto">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Billing Module Component
function BillingModuleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [limits, setLimits] = useState<PlanFeatures | null>(null);
  const [transactionLimit, setTransactionLimit] = useState<LimitCheckResult | null>(null);
  const [accountLimit, setAccountLimit] = useState<LimitCheckResult | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year" | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  // OPTIMIZED: Share household info between components to avoid duplicate calls
  const [householdInfo, setHouseholdInfo] = useState<{ isOwner: boolean; isMember: boolean; ownerId?: string; ownerName?: string } | null>(null);

  const syncSubscription = useCallback(async () => {
    try {
      setSyncing(true);
      console.log("[BILLING] Syncing subscription from Stripe...");
      const response = await fetch("/api/stripe/sync-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("[BILLING] Subscription synced successfully:", data.subscription);
        
        // Invalidate cache after sync
        billingDataCache.data = null;
        billingDataCache.timestamp = 0;
        billingDataCache.promise = null;
        
        toast({
          title: "Subscription Updated",
          description: "Your subscription has been updated successfully.",
        });
        return true;
      } else {
        console.error("[BILLING] Failed to sync subscription:", data.error);
        return false;
      }
    } catch (error) {
      console.error("[BILLING] Error syncing subscription:", error);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  const loadBillingData = useCallback(async (force = false) => {
    // Don't reload if already loaded and not forced
    if (hasLoaded && !syncing && !force) {
      return;
    }

    // Check cache first (unless forced)
    if (!force) {
      const cached = getBillingCacheData();
      if (cached) {
        // Use cached data
        setSubscription(cached.subscription);
        setPlan(cached.plan);
        setLimits(cached.limits);
        setTransactionLimit(cached.transactionLimit);
        setAccountLimit(cached.accountLimit);
        setBillingInterval(cached.interval);
        setHasLoaded(true);
        return;
      }

      // Reuse in-flight request if exists (CRITICAL: Check before creating new promise)
      if (billingDataCache.promise) {
        try {
          const result = await billingDataCache.promise;
          setSubscription(result.subscription);
          setPlan(result.plan);
          setLimits(result.limits);
          setTransactionLimit(result.transactionLimit);
          setAccountLimit(result.accountLimit);
          setBillingInterval(result.interval);
          setHasLoaded(true);
          return;
        } catch (error) {
          // If promise failed, continue to fetch new data
          console.error("Cached promise failed:", error);
        }
      }
    }

    try {
      setLoading(true);
      
      // OPTIMIZATION: Single API call that returns everything (subscription, plan, limits, transactionLimit, accountLimit)
      // This avoids duplicate queries and reduces latency
      // Use shared cache to prevent duplicate calls from SubscriptionProvider
      // getOrCreateBillingPromise will reuse existing promise if one exists
      const result = await getOrCreateBillingPromise(async () => {
        const subResponse = await fetch("/api/billing/subscription", {
        cache: "no-store",
        });
        
        if (!subResponse.ok) {
          console.error("Failed to fetch subscription:", subResponse.status);
          return {
            subscription: null,
            plan: null,
            limits: null,
            transactionLimit: null,
            accountLimit: null,
            interval: null,
          };
        }

        const subData = await subResponse.json();
        return {
          subscription: subData.subscription ?? null,
          plan: subData.plan ?? null,
          limits: subData.limits ?? null,
          transactionLimit: subData.transactionLimit ?? null,
          accountLimit: subData.accountLimit ?? null,
          interval: subData.interval ?? null,
        };
      });

      // Update state
      setSubscription(result.subscription);
      setPlan(result.plan);
      setLimits(result.limits);
      setTransactionLimit(result.transactionLimit);
      setAccountLimit(result.accountLimit);
      setBillingInterval(result.interval);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading billing data:", error);
    } finally {
      setLoading(false);
    }
  }, [hasLoaded, syncing]);
  
  // Mark billing as loaded when data is ready
  useEffect(() => {
    if (!loading && hasLoaded) {
      // Billing data is loaded
    }
  }, [loading, hasLoaded]);

  // Check if user is returning from Stripe Portal
  useEffect(() => {
    const portalReturn = searchParams.get("portal_return");
    if (portalReturn === "true") {
      // Redirect to billing tab
      router.replace("/settings?tab=billing", { scroll: false });
      // Force reload after sync
      setHasLoaded(false);
      // Sync subscription from Stripe
      syncSubscription().then(() => {
        // Reload billing data after sync
        loadBillingData(true);
      });
    }
  }, [searchParams, router, syncSubscription, loadBillingData]);

  // OPTIMIZED: Load household info once and share between components
  useEffect(() => {
    async function loadHouseholdInfo() {
      try {
        const response = await fetch("/api/household/info");
        if (response.ok) {
          const data = await response.json();
          setHouseholdInfo(data);
        }
      } catch (error) {
        console.error("Error loading household info:", error);
      }
    }
    loadHouseholdInfo();
  }, []);

  // Load data on mount immediately
  useEffect(() => {
    if (!hasLoaded) {
      loadBillingData();
    }
  }, [hasLoaded, loadBillingData]);

  // Refresh billing data periodically when billing tab is active
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab !== "billing") return;

    // Refresh data every 30 seconds when billing tab is active
    const interval = setInterval(() => {
      loadBillingData(true); // Force refresh
    }, 30000); // 30 seconds

    // Also refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadBillingData(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [searchParams, loadBillingData]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
          Billing
        </h2>
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
          Manage your subscription and usage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <SubscriptionManagementEmbedded
        subscription={subscription}
        plan={plan}
        interval={billingInterval}
        householdInfo={householdInfo}
        onSubscriptionUpdated={() => {
          // Invalidate cache when subscription is updated
          invalidateBillingCache();
          loadBillingData(true);
        }}
      />

        <UsageChart
          limits={limits ?? undefined}
          transactionLimit={transactionLimit ?? undefined}
          accountLimit={accountLimit ?? undefined}
        />
      </div>


      <PaymentMethodManager />

      <LazyPaymentHistory />
    </div>
  );
}

// Billing Module Component (wrapped for Suspense)
function BillingModule() {
  return (
    <Suspense fallback={null}>
      <BillingModuleContent />
    </Suspense>
  );
}

// Preload billing data hook - loads data in background
// OPTIMIZED: Only preload if billing tab is not active to avoid duplicate calls
function useBillingPreload(activeTab: string) {
  useEffect(() => {
    // Skip preload if billing tab is already active (will load immediately)
    if (activeTab === "billing") {
      return;
    }
    
    // Preload billing data in background when page loads
    // This ensures data is ready when user clicks on Billing tab
    // OPTIMIZATION: Use shared cache to avoid duplicate calls
    const preloadBillingData = async () => {
      try {
        // Check cache first - if already cached, no need to preload
        if (getBillingCacheData()) {
          return; // Already cached
        }
        
        // CRITICAL: Check for in-flight promise BEFORE creating new one
        // This prevents duplicate calls when multiple components try to fetch simultaneously
        if (billingDataCache.promise) {
          // Wait for existing promise to complete
          await billingDataCache.promise;
          return;
        }
        
        // Create new request and cache it using shared cache
        // getOrCreateBillingPromise will handle promise deduplication
        await getOrCreateBillingPromise(async () => {
          const response = await fetch("/api/billing/subscription", { cache: "no-store" });
          if (!response.ok) {
            return {
              subscription: null,
              plan: null,
              limits: null,
              transactionLimit: null,
              accountLimit: null,
              interval: null,
            };
          }
          const data = await response.json();
          return {
            subscription: data.subscription ?? null,
            plan: data.plan ?? null,
            limits: data.limits ?? null,
            transactionLimit: data.transactionLimit ?? null,
            accountLimit: data.accountLimit ?? null,
            interval: data.interval ?? null,
          };
        });
      } catch (error) {
        // Silently fail - data will load when tab is opened
        console.debug("Billing preload failed:", error);
      }
    };

    // Small delay to not block initial page load
    const timer = setTimeout(preloadBillingData, 500);
    return () => clearTimeout(timer);
  }, [activeTab]);
}

// Main My Account Page
export default function MyAccountPage() {
  const perf = usePagePerformance("Settings");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab === "billing" ? "billing" : "profile";
  });

  // Preload billing data in background (only if billing tab is not active)
  useBillingPreload(activeTab);
  
  // Mark as loaded when component mounts (page structure is ready)
  useEffect(() => {
    // Small delay to ensure all modules have initialized
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "billing") {
      setActiveTab("billing");
    } else {
      setActiveTab("profile");
    }
  }, [searchParams]);

  function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "billing") {
      router.replace("/settings?tab=billing", { scroll: false });
    } else {
      router.replace("/settings", { scroll: false });
    }
  }

  return (
      <SimpleTabs 
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
      <PageHeader
        title="My Account"
      />

      {/* Fixed Tabs - Desktop only */}
      <FixedTabsWrapper>
          <SimpleTabsList>
            <SimpleTabsTrigger value="profile">Profile</SimpleTabsTrigger>
            <SimpleTabsTrigger value="billing">Billing</SimpleTabsTrigger>
          </SimpleTabsList>
      </FixedTabsWrapper>

      {/* Mobile/Tablet Tabs - Sticky at top */}
        <div 
        className="lg:hidden sticky top-0 z-40 bg-card dark:bg-transparent border-b"
        >
          <div 
            className="overflow-x-auto scrollbar-hide" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              touchAction: 'pan-x',
            }}
          >
            <SimpleTabsList className="min-w-max px-4" style={{ scrollSnapAlign: 'start' }}>
              <SimpleTabsTrigger value="profile" className="flex-shrink-0 whitespace-nowrap">
                Profile
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="billing" className="flex-shrink-0 whitespace-nowrap">
                Billing
              </SimpleTabsTrigger>
            </SimpleTabsList>
        </div>
      </div>

      <div className="w-full p-4 lg:p-8 space-y-6">
        <SimpleTabsContent value="profile">
          <div className="space-y-6">
            <ProfileModule />
            <HouseholdIncomeSettings />
            <ChangePasswordForm />
            <DeleteAccountSection />
          </div>
        </SimpleTabsContent>

      <SimpleTabsContent value="billing">
        <BillingModule />
      </SimpleTabsContent>
      </div>
      </SimpleTabs>
  );
}
