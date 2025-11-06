"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Edit, Save, X, User } from "lucide-react";

interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
}


export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      // Fetch from Supabase
      const res = await fetch("/api/profile");
      if (res.ok) {
        const profileData = await res.json();
        if (profileData) {
          setProfile(profileData);
          form.reset({
            name: profileData.name || "",
            email: profileData.email || "",
            avatarUrl: profileData.avatarUrl || "",
            phoneNumber: profileData.phoneNumber || "",
          });
        } else {
          // Default profile if no data
          const defaultProfile: Profile = {
            name: "",
            email: "",
            avatarUrl: "",
            phoneNumber: "",
          };
          setProfile(defaultProfile);
          form.reset(defaultProfile);
        }
      } else {
        // Default profile on error
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
      // Default profile on error
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

      // Validate via API
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save profile");
      }

      const updatedProfile = await res.json();
      
      setProfile(updatedProfile);
      setIsEditing(false);
      
      // Show success feedback
      const successEvent = new CustomEvent("profile-saved", { detail: updatedProfile });
      window.dispatchEvent(successEvent);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert(error instanceof Error ? error.message : "Failed to save profile");
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

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your profile information</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-24 bg-muted rounded-full w-24 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your profile information</p>
        </div>
        {!isEditing && (
          <Button
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Your profile information is stored securely in your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {getAvatarUrl() ? (
                  <img
                    src={getAvatarUrl()!}
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover border-2"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      e.currentTarget.style.display = "none";
                      const initialsContainer = e.currentTarget.nextElementSibling;
                      if (initialsContainer) {
                        (initialsContainer as HTMLElement).style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`h-24 w-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold border-2 ${
                    getAvatarUrl() ? "hidden" : "flex"
                  }`}
                >
                  {getInitials(form.watch("name") || profile?.name || "User")}
                </div>
              </div>

              {isEditing && (
                <div className="w-full max-w-md space-y-2">
                  <label className="text-sm font-medium">Avatar URL</label>
                  <Input
                    {...form.register("avatarUrl")}
                    placeholder="https://example.com/avatar.jpg"
                    type="url"
                  />
                  {form.formState.errors.avatarUrl && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.avatarUrl.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enter a URL to your profile image
                  </p>
                </div>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              {isEditing ? (
                <>
                  <Input {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {profile?.name || "Not set"}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              {isEditing ? (
                <>
                  <Input
                    {...form.register("email")}
                    type="email"
                    placeholder="user@example.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {profile?.email || "Not set"}
                </p>
              )}
            </div>

            {/* Phone Number Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              {isEditing ? (
                <>
                  <Input
                    {...form.register("phoneNumber")}
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                  />
                  {form.formState.errors.phoneNumber && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.phoneNumber.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {profile?.phoneNumber || "Not set"}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

