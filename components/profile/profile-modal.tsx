"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, ProfileFormData } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, X, Upload, Camera } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { Loader2 } from "lucide-react";

interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProfileModal({ open, onOpenChange, onSuccess }: ProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (open) {
      loadProfile();
    }
  }, [open]);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      
      if (!res.ok) {
        console.error("Error fetching profile:", res.status, res.statusText);
        // If 404, user might not have profile yet, use empty profile
        if (res.status === 404) {
          const defaultProfile: Profile = {
            name: "",
            email: "",
            avatarUrl: "",
            phoneNumber: "",
          };
          setProfile(defaultProfile);
          form.reset(defaultProfile);
          return;
        }
        // For other errors, try to get error message
        try {
          const errorData = await res.json();
          console.error("Profile error:", errorData);
        } catch (e) {
          // Ignore JSON parse errors
        }
        // Use empty profile on error
        const defaultProfile: Profile = {
          name: "",
          email: "",
          avatarUrl: "",
          phoneNumber: "",
        };
        setProfile(defaultProfile);
        form.reset(defaultProfile);
        return;
      }

      const profileData = await res.json().catch((error) => {
        console.error("Error parsing profile JSON:", error);
        return null;
      });
      
      console.log("Profile data loaded:", profileData);
      
      if (profileData) {
        setProfile(profileData);
        form.reset({
          name: profileData.name || "",
          email: profileData.email || "",
          avatarUrl: profileData.avatarUrl || "",
          phoneNumber: profileData.phoneNumber || "",
        });
        console.log("Profile form reset with data:", {
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
        console.log("Profile form reset with default (empty) data");
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
      
      toast({ title: "Success", description: "Avatar uploaded successfully", variant: "success" });
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

  async function onSubmit(data: ProfileFormData) {
    try {
      setSaving(true);

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let errorMessage = "Failed to save profile";
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

      const updatedProfile = await res.json();
      
      setProfile(updatedProfile);
      
      // Show success toast
      toast({ title: "Success", description: "Profile updated successfully", variant: "success" });

      // Reload user data in nav
      window.dispatchEvent(new CustomEvent("profile-updated"));
      
      // Call onSuccess callback if provided
      onSuccess?.();
      
      // Close modal after successful save
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            Manage your profile information
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="space-y-6 py-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-muted rounded-full w-32 mx-auto"></div>
                  <div className="space-y-3">
                    <div className="h-10 bg-muted rounded w-full"></div>
                    <div className="h-10 bg-muted rounded w-full"></div>
                    <div className="h-10 bg-muted rounded w-full"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center space-y-4 flex-shrink-0">
                  <div 
                    className="relative group cursor-pointer"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    {getAvatarUrl() ? (
                      <img
                        src={getAvatarUrl()!}
                        alt="Profile"
                        className="h-32 w-32 rounded-full object-cover border border-border"
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
                      className={`h-32 w-32 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-semibold border border-border ${
                        getAvatarUrl() ? "hidden" : "flex"
                      }`}
                    >
                      {getInitials(form.watch("name") || profile?.name || "User")}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-background/80 dark:bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="h-6 w-6 text-foreground" />
                    </div>
                  </div>

                  <div className="w-full max-w-xs space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Change Avatar"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      JPG, PNG or GIF. Max size 5MB
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-4">
                {/* Name Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    {...form.register("name")}
                    placeholder="Enter your name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    {...form.register("email")}
                    type="email"
                    placeholder="Enter your email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Phone Number Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Phone Number
                  </label>
                  <Input
                    {...form.register("phoneNumber")}
                    type="tel"
                    placeholder="Enter your phone number"
                  />
                  {form.formState.errors.phoneNumber && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.phoneNumber.message}
                    </p>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={saving || uploading || loading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saving || uploading || loading}
            >
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

