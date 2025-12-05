"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { locationSchema } from "@/src/domain/taxes/taxes.validations";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LocationFormData = {
  country: "US" | "CA";
  stateOrProvince: string | null;
};

interface LocationStepProps {
  onComplete?: (data: LocationFormData) => void;
  initialData?: {
    country?: string | null;
    stateOrProvince?: string | null;
  };
  formRef?: React.RefObject<HTMLFormElement>;
  onValidationChange?: (isValid: boolean) => void;
}

// US States
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

// Canadian Provinces and Territories
const CANADIAN_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

export function LocationStep({ onComplete, initialData, formRef, onValidationChange }: LocationStepProps) {
  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      country: (initialData?.country as "US" | "CA") || "US",
      stateOrProvince: initialData?.stateOrProvince || null,
    },
    mode: "onChange",
  });

  const country = form.watch("country");
  const stateOrProvince = form.watch("stateOrProvince");

  // Update validation state
  useEffect(() => {
    const isValid = !!country && !!stateOrProvince;
    onValidationChange?.(isValid);
  }, [country, stateOrProvince, onValidationChange]);

  // Reset state/province when country changes
  useEffect(() => {
    if (country) {
      form.setValue("stateOrProvince", null);
    }
  }, [country, form]);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      form.reset({
        country: (initialData.country as "US" | "CA") || "US",
        stateOrProvince: initialData.stateOrProvince || null,
      });
    } else {
      loadLocation();
    }
  }, [initialData]);

  async function loadLocation() {
    try {
      const res = await fetch("/api/v2/onboarding/location");
      if (res.ok) {
        const data = await res.json();
        if (data.country) {
          form.reset({
            country: (data.country as "US" | "CA") || "US",
            stateOrProvince: data.stateOrProvince || null,
          });
        }
      }
    } catch (error) {
      console.error("Error loading location:", error);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = form.getValues();
    if (data.country && data.stateOrProvince) {
      onComplete?.(data);
    }
  }

  const statesOrProvinces = country === "US" ? US_STATES : country === "CA" ? CANADIAN_PROVINCES : [];

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Controller
            name="country"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("stateOrProvince", null);
                }}
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.country && (
            <p className="text-sm text-destructive">{form.formState.errors.country.message}</p>
          )}
        </div>

        {country && (
          <div className="space-y-2">
            <Label htmlFor="stateOrProvince">
              {country === "US" ? "State" : "Province/Territory"}
            </Label>
            <Controller
              name="stateOrProvince"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger id="stateOrProvince">
                    <SelectValue
                      placeholder={`Select your ${country === "US" ? "state" : "province/territory"}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {statesOrProvinces.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.stateOrProvince && (
              <p className="text-sm text-destructive">
                {form.formState.errors.stateOrProvince.message}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

