/**
 * Federal Tax Brackets Service Factory
 */

import { FederalBracketsService } from "./federal-brackets.service";
import { FederalBracketsRepository } from "@/src/infrastructure/database/repositories/federal-brackets.repository";

export function makeFederalBracketsService(): FederalBracketsService {
  const repository = new FederalBracketsRepository();
  return new FederalBracketsService(repository);
}

