"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
import { profileSchema, ProfileFormData } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Edit, Save, X, User, CreditCard, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { UsageChart } from "@/components/billing/usage-chart";
import { UpgradePlanCard } from "@/components/billing/upgrade-plan-card";
import { PaymentHistory } from "@/components/billing/payment-history";
import { SubscriptionManagement } from "@/components/billing/subscription-management";
import { Subscription, Plan } from "@/lib/validations/plan";
import { PlanFeatures, LimitCheckResult } from "@/lib/api/limits";
import { PageHeader } from "@/components/common/page-header";

// Profile interfaces
interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
  plan?: {
    name: "free" | "basic" | "premium";
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


// Profile Module Component
function ProfileModule() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      avatarUrl: "",
      phoneNumber: "",
    },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const { getProfileClient } = await import("@/lib/api/profile-client");
      const profileData = await getProfileClient();
      if (profileData) {
        setProfile(profileData);
        form.reset({
          name: profileData.name || "",
          email: profileData.email || "",
          avatarUrl: profileData.avatarUrl || "",
          phoneNumber: profileData.phoneNumber || "",
        });
      } else {
        const defaultProfile: Profile = {
          name: "",
          email: "",
          avatarUrl: "",
          phoneNumber: "",
        };
        setProfile(defaultProfile);
        form.reset(defaultProfile);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      const defaultProfile: Profile = {
        name: "",
        email: "",
        avatarUrl: "",
        phoneNumber: "",
      };
      setProfile(defaultProfile);
      form.reset(defaultProfile);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: ProfileFormData) {
    try {
      setSaving(true);
      const { updateProfileClient } = await import("@/lib/api/profile-client");
      const updatedProfile = await updateProfileClient(data);
      setProfile(updatedProfile);
      setIsEditing(false);
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

  function handleCancel() {
    if (profile) {
      form.reset({
        name: profile.name || "",
        email: profile.email || "",
        avatarUrl: profile.avatarUrl || "",
        phoneNumber: profile.phoneNumber || "",
      });
    }
    setIsEditing(false);
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
        const { updateProfileClient } = await import("@/lib/api/profile-client");
        const updatedProfile = await updateProfileClient({ avatarUrl: url });
        setProfile(updatedProfile);
        
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

  if (loading) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded-full w-16 mx-auto sm:h-20 sm:w-20"></div>
            <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <CardTitle className="text-base sm:text-lg">Profile</CardTitle>
          </div>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="small"
              className="w-full sm:w-auto"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6">
            {/* Avatar Section - Left Side */}
            <div className="flex flex-col items-center sm:items-start space-y-2">
              <div className="relative">
                {getAvatarUrl() ? (
                  <img
                    src={getAvatarUrl()!}
                    alt="Profile"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2"
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
              
              {isEditing && (
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
              )}
            </div>

            {/* Form Fields Section - Right Side */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Name</label>
                  {isEditing ? (
                    <>
                      <Input {...form.register("name")} className="h-9" />
                      {form.formState.errors.name && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-1">
                      {profile?.name || "Not set"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Email</label>
                  {isEditing ? (
                    <>
                      <Input
                        {...form.register("email")}
                        type="email"
                        placeholder="user@example.com"
                        className="h-9"
                      />
                      {form.formState.errors.email && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-1">
                      {profile?.email || "Not set"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Phone Number</label>
                  {isEditing ? (
                    <>
                      <Input
                        {...form.register("phoneNumber")}
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        className="h-9"
                      />
                      {form.formState.errors.phoneNumber && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.phoneNumber.message}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-1">
                      {profile?.phoneNumber || "Not set"}
                    </p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="small"
                    onClick={handleCancel}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
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
              )}
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
  const [interval, setInterval] = useState<"month" | "year" | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true);
      const [subResponse, limitsAction] = await Promise.all([
        fetch("/api/billing/subscription"),
        import("@/lib/actions/billing").then(m => m.getBillingLimitsAction()),
      ]);

      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
        setPlan(subData.plan);
        setLimits(subData.limits);
        setInterval(subData.interval || null);
      }

      if (limitsAction) {
        setTransactionLimit(limitsAction.transactionLimit);
        setAccountLimit(limitsAction.accountLimit);
      }
    } catch (error) {
      console.error("Error loading billing data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is returning from Stripe Portal
  useEffect(() => {
    const portalReturn = searchParams.get("portal_return");
    if (portalReturn === "true") {
      // Remove the parameter from URL
      router.replace("/settings?tab=billing", { scroll: false });
      // Sync subscription from Stripe
      syncSubscription().then(() => {
        // Reload billing data after sync
        loadBillingData();
      });
    }
  }, [searchParams, router, syncSubscription, loadBillingData]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  if (loading || syncing) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing
          </CardTitle>
          <CardDescription>Manage your subscription and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
        <SubscriptionManagement
          subscription={subscription}
          plan={plan}
          interval={interval}
          onSubscriptionUpdated={loadBillingData}
        />

        {limits && transactionLimit && accountLimit && (
          <UsageChart
            limits={limits}
            transactionLimit={transactionLimit}
            accountLimit={accountLimit}
          />
        )}
      </div>

      <UpgradePlanCard 
        currentPlan={plan?.name} 
        currentPlanId={plan?.id}
        onUpgradeSuccess={loadBillingData}
      />

      <PaymentHistory />
    </div>
  );
}

// Billing Module Component (wrapped for Suspense)
function BillingModule() {
  return (
    <Suspense fallback={
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing
          </CardTitle>
          <CardDescription>Manage your subscription and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    }>
      <BillingModuleContent />
    </Suspense>
  );
}

// Main My Account Page
export default function MyAccountPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="My Account"
        description="Manage your account settings and preferences"
      />

      <div className="space-y-4 md:space-y-6">
        <ProfileModule />
        <BillingModule />
      </div>
    </div>
  );
}
