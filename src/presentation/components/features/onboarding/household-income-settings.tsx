"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { cn } from "@/lib/utils";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { locationSchema, LocationFormData } from "@/src/domain/taxes/taxes.validations";

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

const INCOME_RANGES: Array<{ value: NonNullable<ExpectedIncomeRange>; label: string }> = [
  { value: "0-50k", label: "$0 - $50,000" },
  { value: "50k-100k", label: "$50,000 - $100,000" },
  { value: "100k-150k", label: "$100,000 - $150,000" },
  { value: "150k-250k", label: "$150,000 - $250,000" },
  { value: "250k+", label: "$250,000+" },
];

// Convert numeric value to ExpectedIncomeRange
function convertToIncomeRange(value: number): ExpectedIncomeRange {
  if (value < 50000) return "0-50k";
  if (value < 100000) return "50k-100k";
  if (value < 150000) return "100k-150k";
  if (value < 250000) return "150k-250k";
  return "250k+";
}

export function HouseholdIncomeSettings() {
  const { toast } = useToast();
  const [selectedIncome, setSelectedIncome] = useState<ExpectedIncomeRange>(null);
  const [customIncome, setCustomIncome] = useState<number | undefined>(undefined);
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const customIncomeInputRef = useRef<HTMLInputElement>(null);

  // Location form
  const locationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      country: "US" as "US" | "CA",
      stateOrProvince: null,
    },
    mode: "onChange",
  });

  const selectedCountry = locationForm.watch("country");
  const selectedStateOrProvince = locationForm.watch("stateOrProvince");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevCountryRef = useRef<string | null>(null);

  // Reset state/province when country changes (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad && prevCountryRef.current && prevCountryRef.current !== selectedCountry) {
      locationForm.setValue("stateOrProvince", null);
    }
    prevCountryRef.current = selectedCountry;
  }, [selectedCountry, locationForm, isInitialLoad]);

  useEffect(() => {
    loadCurrentData();
  }, []);

  // Focus the input when custom option is selected
  useEffect(() => {
    if (useCustom && customIncomeInputRef.current) {
      setTimeout(() => {
        customIncomeInputRef.current?.focus();
      }, 100);
    }
  }, [useCustom]);

  async function loadCurrentData() {
    try {
      setLoading(true);
      
      // Load income
      const incomeResponse = await fetch("/api/v2/onboarding/income");
      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        if (incomeData.expectedIncome) {
          setSelectedIncome(incomeData.expectedIncome);
        }
        
        // If there's a custom amount, show it and enable custom mode
        if (incomeData.expectedIncomeAmount !== null && incomeData.expectedIncomeAmount !== undefined) {
          setCustomIncome(incomeData.expectedIncomeAmount);
          setUseCustom(true);
        }
      }

      // Load location
      const locationResponse = await fetch("/api/v2/onboarding/location");
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        if (locationData.country) {
          locationForm.reset({
            country: (locationData.country as "US" | "CA") || "US",
            stateOrProvince: locationData.stateOrProvince || null,
          });
          prevCountryRef.current = (locationData.country as "US" | "CA") || "US";
        }
      }

    } catch (error) {
      console.error("Error loading current data:", error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }

  function handleIncomeChange(value: string) {
    if (value === "custom") {
      setUseCustom(true);
      return;
    }
    
    setUseCustom(false);
    setCustomIncome(undefined);
    const incomeValue = value as ExpectedIncomeRange;
    setSelectedIncome(incomeValue);
  }

  function handleCustomIncomeChange(value: number | undefined) {
    setCustomIncome(value);
    // Convert custom value to nearest range only if we have a valid value
    if (value !== undefined && value > 0) {
      const incomeRange = convertToIncomeRange(value);
      setSelectedIncome(incomeRange);
    }
  }

  async function handleSave() {
    if (useCustom && (!customIncome || customIncome <= 0)) {
      toast({
        title: "Please enter your annual household income",
        description: "Enter your expected annual household income to update your settings.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedIncome && !useCustom) {
      toast({
        title: "Please select an income range",
        description: "Select your expected household income to update your settings.",
        variant: "destructive",
      });
      return;
    }

    // Validate location
    const locationData = locationForm.getValues();
    if (!locationData.country || !locationData.stateOrProvince) {
      toast({
        title: "Please select your location",
        description: "Select your country and state/province to update your settings.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Save income
      const incomeRequestBody: { incomeRange: ExpectedIncomeRange; incomeAmount?: number | null } = {
        incomeRange: selectedIncome,
      };
      
      // Include custom amount if user provided one
      if (useCustom && customIncome && customIncome > 0) {
        incomeRequestBody.incomeAmount = customIncome;
      } else {
        // If not using custom, clear the custom amount
        incomeRequestBody.incomeAmount = null;
      }

      const incomeResponse = await fetch("/api/v2/onboarding/income", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(incomeRequestBody),
      });

      if (!incomeResponse.ok) {
        const error = await incomeResponse.json();
        throw new Error(error.error || "Failed to save income");
      }

      // Save location
      const locationResponse = await fetch("/api/v2/onboarding/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(locationData),
      });

      if (!locationResponse.ok) {
        const error = await locationResponse.json();
        throw new Error(error.error || "Failed to save location");
      }

      toast({
        title: "Settings updated",
        description: "Your expected income and location have been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-0">
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const statesOrProvinces = selectedCountry === "US" ? US_STATES : selectedCountry === "CA" ? CANADIAN_PROVINCES : [];

  return (
    <Card className="border-0">
      <CardContent className="space-y-6">
        <div className="space-y-6">
          {/* Location Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Location</Label>
              <p className="text-xs text-muted-foreground">
                Used to automatically calculate taxes for accurate budget and emergency fund calculations.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Controller
                  name="country"
                  control={locationForm.control}
                  render={({ field }) => (
                    <Tabs
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Only reset if not initial load
                        if (!isInitialLoad) {
                          locationForm.setValue("stateOrProvince", null);
                        }
                      }}
                      className="w-full"
                    >
                      <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="US" className="w-full">United States</TabsTrigger>
                        <TabsTrigger value="CA" className="w-full">Canada</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                />
                {locationForm.formState.errors.country && (
                  <p className="text-sm text-destructive">{locationForm.formState.errors.country.message}</p>
                )}
              </div>

              {selectedCountry && statesOrProvinces.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="stateOrProvince">
                    {selectedCountry === "US" ? "State" : "Province/Territory"}
                  </Label>
                  <Controller
                    name="stateOrProvince"
                    control={locationForm.control}
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                      >
                        <SelectTrigger id="stateOrProvince">
                          <SelectValue
                            placeholder={`Select your ${selectedCountry === "US" ? "state" : "province/territory"}`}
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
                  {locationForm.formState.errors.stateOrProvince && (
                    <p className="text-sm text-destructive">
                      {locationForm.formState.errors.stateOrProvince.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Income Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Annual Household Income</Label>
              <p className="text-xs text-muted-foreground">
                Used to personalize your budgets and calculate accurate emergency fund targets.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {INCOME_RANGES.map((range) => {
                const isSelected = !useCustom && selectedIncome === range.value;
                return (
                  <Card
                    key={range.value}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      isSelected && "border-primary border-2 bg-primary/5"
                    )}
                    onClick={() => handleIncomeChange(range.value)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="text-sm font-medium">{range.label}</span>
                    </CardContent>
                  </Card>
                );
              })}
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  useCustom && "border-primary border-2 bg-primary/5"
                )}
                onClick={() => handleIncomeChange("custom")}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm font-medium">Custom amount</span>
                </CardContent>
              </Card>
            </div>

            {useCustom && (
              <div className="pt-2">
                <Label htmlFor="custom-income" className="text-sm text-muted-foreground mb-1 block">
                  Enter your annual household income
                </Label>
                <DollarAmountInput
                  ref={customIncomeInputRef}
                  id="custom-income"
                  value={customIncome || undefined}
                  onChange={handleCustomIncomeChange}
                  placeholder="$ 0.00"
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || (!selectedIncome && !(useCustom && customIncome && customIncome > 0)) || !selectedCountry || !selectedStateOrProvince}
            size="medium"
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
        </div>
      </CardContent>
    </Card>
  );
}

