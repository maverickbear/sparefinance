/**
 * Script to populate tax brackets and tax rates in the database
 * Run with: npx tsx scripts/populate-tax-data.ts
 */

import { FederalBracketsRepository } from "@/src/infrastructure/database/repositories/federal-brackets.repository";
import { TaxRatesRepository } from "@/src/infrastructure/database/repositories/tax-rates.repository";
import {
  US_FEDERAL_BRACKETS_2024,
  US_STATE_TAX_RATES_2024,
  CANADA_FEDERAL_BRACKETS_2024,
  CANADA_FEDERAL_BRACKETS_2025,
  CANADA_PROVINCIAL_TAX_RATES_2024,
} from "@/src/infrastructure/taxes/tax-brackets";
import { logger } from "@/src/infrastructure/utils/logger";

// State/Province display names
const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const CANADA_PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

async function populateFederalBrackets() {
  logger.info("[PopulateTaxData] Starting to populate federal brackets...");
  const repository = new FederalBracketsRepository();

  // US Federal Brackets 2024
  logger.info("[PopulateTaxData] Inserting US Federal Brackets 2024...");
  for (let i = 0; i < US_FEDERAL_BRACKETS_2024.length; i++) {
    const bracket = US_FEDERAL_BRACKETS_2024[i];
    try {
      await repository.create({
        countryCode: "US",
        taxYear: 2024,
        bracketOrder: i + 1,
        minIncome: bracket.min,
        maxIncome: bracket.max,
        taxRate: bracket.rate,
        isActive: true,
      });
      logger.info(
        `[PopulateTaxData] Inserted US bracket ${i + 1}: ${bracket.min} - ${bracket.max ?? "∞"} @ ${(bracket.rate * 100).toFixed(1)}%`
      );
    } catch (error) {
      logger.error(`[PopulateTaxData] Error inserting US bracket ${i + 1}:`, error);
    }
  }

  // Canada Federal Brackets 2024
  logger.info("[PopulateTaxData] Inserting Canada Federal Brackets 2024...");
  for (let i = 0; i < CANADA_FEDERAL_BRACKETS_2024.length; i++) {
    const bracket = CANADA_FEDERAL_BRACKETS_2024[i];
    try {
      await repository.create({
        countryCode: "CA",
        taxYear: 2024,
        bracketOrder: i + 1,
        minIncome: bracket.min,
        maxIncome: bracket.max,
        taxRate: bracket.rate,
        isActive: true,
      });
      logger.info(
        `[PopulateTaxData] Inserted CA 2024 bracket ${i + 1}: ${bracket.min} - ${bracket.max ?? "∞"} @ ${(bracket.rate * 100).toFixed(1)}%`
      );
    } catch (error) {
      logger.error(`[PopulateTaxData] Error inserting CA 2024 bracket ${i + 1}:`, error);
    }
  }

  // Canada Federal Brackets 2025
  logger.info("[PopulateTaxData] Inserting Canada Federal Brackets 2025...");
  for (let i = 0; i < CANADA_FEDERAL_BRACKETS_2025.length; i++) {
    const bracket = CANADA_FEDERAL_BRACKETS_2025[i];
    try {
      await repository.create({
        countryCode: "CA",
        taxYear: 2025,
        bracketOrder: i + 1,
        minIncome: bracket.min,
        maxIncome: bracket.max,
        taxRate: bracket.rate,
        isActive: true,
      });
      logger.info(
        `[PopulateTaxData] Inserted CA 2025 bracket ${i + 1}: ${bracket.min} - ${bracket.max ?? "∞"} @ ${(bracket.rate * 100).toFixed(1)}%`
      );
    } catch (error) {
      logger.error(`[PopulateTaxData] Error inserting CA 2025 bracket ${i + 1}:`, error);
    }
  }

  logger.info("[PopulateTaxData] Finished populating federal brackets");
}

async function populateTaxRates() {
  logger.info("[PopulateTaxData] Starting to populate tax rates...");
  const repository = new TaxRatesRepository();

  // US State Tax Rates
  logger.info("[PopulateTaxData] Inserting US State Tax Rates...");
  for (const [stateCode, rate] of Object.entries(US_STATE_TAX_RATES_2024)) {
    try {
      const displayName = US_STATE_NAMES[stateCode] || stateCode;
      const description =
        rate === 0
          ? "No state income tax"
          : `Effective state income tax rate for ${displayName}`;

      await repository.create({
        countryCode: "US",
        stateOrProvinceCode: stateCode,
        taxRate: rate,
        displayName: displayName,
        description: description,
        isActive: true,
      });
      logger.info(
        `[PopulateTaxData] Inserted US state ${stateCode} (${displayName}): ${(rate * 100).toFixed(2)}%`
      );
    } catch (error) {
      logger.error(`[PopulateTaxData] Error inserting US state ${stateCode}:`, error);
    }
  }

  // Canada Provincial Tax Rates
  logger.info("[PopulateTaxData] Inserting Canada Provincial Tax Rates...");
  for (const [provinceCode, rate] of Object.entries(CANADA_PROVINCIAL_TAX_RATES_2024)) {
    try {
      const displayName = CANADA_PROVINCE_NAMES[provinceCode] || provinceCode;
      const description = `Effective provincial income tax rate for ${displayName}`;

      await repository.create({
        countryCode: "CA",
        stateOrProvinceCode: provinceCode,
        taxRate: rate,
        displayName: displayName,
        description: description,
        isActive: true,
      });
      logger.info(
        `[PopulateTaxData] Inserted CA province ${provinceCode} (${displayName}): ${(rate * 100).toFixed(2)}%`
      );
    } catch (error) {
      logger.error(`[PopulateTaxData] Error inserting CA province ${provinceCode}:`, error);
    }
  }

  logger.info("[PopulateTaxData] Finished populating tax rates");
}

async function main() {
  try {
    logger.info("[PopulateTaxData] Starting tax data population...");

    await populateFederalBrackets();
    await populateTaxRates();

    logger.info("[PopulateTaxData] Tax data population completed successfully!");
  } catch (error) {
    logger.error("[PopulateTaxData] Error populating tax data:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { populateFederalBrackets, populateTaxRates };
