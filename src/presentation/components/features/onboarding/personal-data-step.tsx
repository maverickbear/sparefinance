"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { formatDateInput, parseDateInput } from "@/src/infrastructure/utils/timestamp";

const personalDataSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional(), // Email is read-only, so optional in validation
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

type PersonalDataFormData = z.infer<typeof personalDataSchema>;

interface PersonalDataStepProps {
  onComplete?: (data: PersonalDataFormData) => void;
  initialData?: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
  };
  formRef?: React.RefObject<HTMLFormElement>;
  onValidationChange?: (isValid: boolean) => void;
}

export function PersonalDataStep({ onComplete, initialData, formRef, onValidationChange }: PersonalDataStepProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<{
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
  } | null>(initialData || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PersonalDataFormData>({
    resolver: zodResolver(personalDataSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      avatarUrl: initialData?.avatarUrl || "",
      phoneNumber: initialData?.phoneNumber || "",
      dateOfBirth: initialData?.dateOfBirth || "",
    },
    mode: "onChange",
  });

  // Watch form values and validate
  const name = form.watch("name");
  const initializedRef = useRef(false);
  const previousInitialDataRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only name is required now
    const isValid = !!(name && name.trim());
    onValidationChange?.(isValid);
  }, [name, onValidationChange]);

  useEffect(() => {
    // Only initialize once on mount
    if (!initializedRef.current) {
      if (initialData) {
        form.reset({
          name: initialData.name || "",
          email: initialData.email || "",
          avatarUrl: initialData.avatarUrl || "",
          phoneNumber: initialData.phoneNumber || "",
          dateOfBirth: initialData.dateOfBirth || "",
        });
        setProfile(initialData);
        initializedRef.current = true;
      } else {
        // Only load profile on first mount if no initialData
        loadProfile();
        initializedRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  async function loadProfile() {
    try {
      const res = await fetch("/api/v2/profile");
      if (res.ok) {
        const profileData = await res.json();
        setProfile(profileData);
        form.reset({
          name: profileData.name || "",
          email: profileData.email || "",
          avatarUrl: profileData.avatarUrl || "",
          phoneNumber: profileData.phoneNumber || "",
          dateOfBirth: profileData.dateOfBirth || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
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

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v2/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload avatar";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { url } = await res.json();
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function onSubmit(data: PersonalDataFormData) {
    // Convert dateOfBirth from Date to string if needed
    let dateOfBirthString = data.dateOfBirth;
    if (data.dateOfBirth && !data.dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // If it's a Date object or other format, convert it
        const date = (data.dateOfBirth as any) instanceof Date 
        ? (data.dateOfBirth as unknown) as Date
        : ((new Date(data.dateOfBirth as unknown as string | number)) as unknown) as Date;
      if (!isNaN(date.getTime())) {
        dateOfBirthString = formatDateInput(date);
      }
    }

    // Just pass data to parent component, don't save to backend yet
    if (onComplete) {
      onComplete({
        name: data.name,
        email: data.email || "",
        avatarUrl: data.avatarUrl || "",
        phoneNumber: data.phoneNumber || "",
        dateOfBirth: dateOfBirthString || "",
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

  function getInitials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  // Get dateOfBirth as Date object for DatePicker
  const dateOfBirthDate = form.watch("dateOfBirth") 
    ? (() => {
        const value = form.watch("dateOfBirth");
        if (!value) return undefined;
        if ((value as any) instanceof Date) return (value as unknown) as Date;
        if (typeof value === "string") {
          const parsed = new Date(value);
          return isNaN(parsed.getTime()) ? undefined : (parsed as unknown) as Date | undefined;
        }
        if (typeof value === "string") {
          try {
            return parseDateInput(value);
          } catch {
            return undefined;
          }
        }
        return undefined;
      })()
    : undefined;

  return (
    <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Avatar Section - Left Side */}
        <div className="flex flex-col items-center space-y-4 sm:w-1/3">
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
                className="h-24 w-24 rounded-full object-cover border-2 border-border"
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
              className={`h-24 w-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold border-2 border-border ${
                getAvatarUrl() ? "hidden" : "flex"
              }`}
            >
              {getInitials(profile?.name as string || form.watch("name") || "User")}
            </div>
            <div className="absolute inset-0 rounded-full bg-background/80 dark:bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-5 w-5 text-foreground" />
            </div>
          </div>

          <div className="w-full space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <p className="text-xs text-center text-muted-foreground">
              Click on avatar to upload (JPG, PNG or GIF. Max size 5MB)
            </p>
          </div>
        </div>

        {/* Form Fields - Right Side */}
        <div className="flex-1 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...form.register("name")}
              type="text"
              placeholder="Enter your name"
              required
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              {...form.register("email")}
              type="email"
              placeholder="Enter your email"
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Phone Number and Date of Birth - Side by Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">
                Phone Number
              </Label>
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
                    />
                    {fieldState.error && (
                      <p className="text-sm text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label>
                Date of Birth
              </Label>
              <DatePicker
                date={dateOfBirthDate}
                onDateChange={(date) => {
                  if (date) {
                    form.setValue("dateOfBirth", formatDateInput(date), { shouldValidate: true });
                  } else {
                    form.setValue("dateOfBirth", "", { shouldValidate: true });
                  }
                }}
                placeholder="Select your date of birth"
              />
              {form.formState.errors.dateOfBirth && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dateOfBirth.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

