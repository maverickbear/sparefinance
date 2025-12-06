/**
 * Tax Rates Service Factory
 * Dependency injection for Tax Rates Service
 */

import { TaxRatesService } from "./tax-rates.service";
import { TaxRatesRepository } from "@/src/infrastructure/database/repositories/tax-rates.repository";

export function makeTaxRatesService(): TaxRatesService {
  const repository = new TaxRatesRepository();
  return new TaxRatesService(repository);
}

