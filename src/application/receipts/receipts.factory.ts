/**
 * Receipts Factory
 * Dependency injection factory for ReceiptsService
 */

import { ReceiptsService } from "./receipts.service";
import { OpenAIClient } from "@/src/infrastructure/external/openai/openai-client";

/**
 * Create a ReceiptsService instance with all dependencies
 */
export function makeReceiptsService(): ReceiptsService {
  const openaiClient = new OpenAIClient();
  return new ReceiptsService(openaiClient);
}

