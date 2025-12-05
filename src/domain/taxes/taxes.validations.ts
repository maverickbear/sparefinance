/**
 * Domain validations for tax calculations
 * Zod schemas for tax-related inputs
 */

import { z } from "zod";

// ISO 3166-1 alpha-2 country codes (US and Canada for now)
const SUPPORTED_COUNTRIES = ["US", "CA"] as const;

// US state codes (all 50 states + DC)
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
] as const;

// Canadian provinces and territories
const CANADIAN_PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
] as const;

export const countryCodeSchema = z.enum(SUPPORTED_COUNTRIES, {
  errorMap: () => ({ message: "Country must be US or CA" }),
});

export const usStateCodeSchema = z.enum(US_STATES, {
  errorMap: () => ({ message: "Invalid US state code" }),
});

export const canadianProvinceCodeSchema = z.enum(CANADIAN_PROVINCES, {
  errorMap: () => ({ message: "Invalid Canadian province/territory code" }),
});

export const stateOrProvinceCodeSchema = z.union([
  usStateCodeSchema,
  canadianProvinceCodeSchema,
]).nullable().optional();

export const taxCalculationInputSchema = z.object({
  country: countryCodeSchema,
  stateOrProvince: stateOrProvinceCodeSchema,
  annualIncome: z.number().min(0, "Annual income must be non-negative"),
});

export type TaxCalculationInputFormData = z.infer<typeof taxCalculationInputSchema>;

// Location schema for household settings
export const locationSchema = z.object({
  country: countryCodeSchema,
  stateOrProvince: stateOrProvinceCodeSchema,
});

export type LocationFormData = z.infer<typeof locationSchema>;

