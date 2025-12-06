"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, ProfileFormData } from "@/src/domain/profile/profile.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, User, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDateInput, parseDateInput } from "@/src/infrastructure/utils/timestamp";

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

export function ProfileModule() {
  // Check cache immediately to avoid showing skeleton if data is already available
  const hasCachedData = profileDataCache.data && 
    (Date.now() - profileDataCache.timestamp) < profileDataCache.TTL;
  
  const [profile, setProfile] = useState<Profile | null>(hasCachedData ? profileDataCache.data : null);
  const [loading, setLoading] = useState(!hasCachedData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userCountry, setUserCountry] = useState<"US" | "CA">("US");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: hasCachedData ? (profileDataCache.data?.name || "") : "",
      avatarUrl: hasCachedData ? (profileDataCache.data?.avatarUrl || "") : "",
      phoneNumber: hasCachedData ? (profileDataCache.data?.phoneNumber || "") : "",
      dateOfBirth: hasCachedData ? (profileDataCache.data?.dateOfBirth || "") : "",
    },
  });

  useEffect(() => {
    // Load user location for phone number country code
    async function loadUserLocation() {
      try {
        const response = await fetch("/api/v2/onboarding/location");
        if (response.ok) {
          const location = await response.json();
          if (location.country && (location.country === "US" || location.country === "CA")) {
            setUserCountry(location.country);
          }
        }
      } catch (error) {
        console.error("Error loading user location:", error);
        // Keep default "US" if error
      }
    }
    loadUserLocation();

    // If we have cached data, set form values immediately and skip loading
    if (hasCachedData && profileDataCache.data) {
      form.reset({
        name: profileDataCache.data.name || "",
        avatarUrl: profileDataCache.data.avatarUrl || "",
        phoneNumber: profileDataCache.data.phoneNumber || "",
        dateOfBirth: profileDataCache.data.dateOfBirth || "",
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
          dateOfBirth: cached.dateOfBirth || "",
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
              dateOfBirth: result.dateOfBirth || "",
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
          dateOfBirth: profileData.dateOfBirth || "",
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
          dateOfBirth: "",
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
        dateOfBirth: "",
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
      const res = await fetch("/api/v2/profile/avatar", {
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
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-row items-start gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted animate-pulse flex-shrink-0" />
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
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Avatar Section */}
            <div className="flex flex-row items-start gap-4">
              <div className="relative flex-shrink-0">
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
              
              <div className="flex flex-col justify-center space-y-1 flex-1">
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
                  className="w-fit"
                >
                  <Upload className="mr-2 h-3 w-3" />
                  {uploading ? "Uploading..." : "Upload Avatar"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max size 5MB
                </p>
              </div>
            </div>

            {/* Form Fields Section */}
            <div className="space-y-3">
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
                <Controller
                  name="phoneNumber"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <PhoneNumberInput
                        id="phoneNumber"
                        value={field.value || undefined}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="(XXX) XXX-XXXX"
                        size="medium"
                        defaultCountry={userCountry}
                      />
                      {fieldState.error && (
                        <p className="text-xs text-destructive">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Controller
                  name="dateOfBirth"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <DatePicker
                        date={(() => {
                          const value = field.value;
                          if (!value) return undefined;
                          if ((value as any) instanceof Date) return (value as unknown) as Date;
                          if (typeof value === "string") {
                            try {
                              return parseDateInput(value) as unknown as Date;
                            } catch {
                              const parsed = new Date(value);
                              return isNaN(parsed.getTime()) ? undefined : (parsed as unknown as Date);
                            }
                          }
                          return undefined;
                        })()}
                        onDateChange={(date) => {
                          if (date) {
                            field.onChange(formatDateInput(date));
                          } else {
                            field.onChange("");
                          }
                        }}
                        placeholder="Select your date of birth"
                        size="medium"
                      />
                      {fieldState.error && (
                        <p className="text-xs text-destructive">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
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

