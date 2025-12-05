/**
 * Taxes Service Factory
 * Dependency injection for TaxesService
 */

import { TaxesService } from "./taxes.service";

export function makeTaxesService(): TaxesService {
  return new TaxesService();
}

