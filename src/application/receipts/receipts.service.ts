/**
 * Receipts Service
 * Business logic for receipt scanning
 */

import { OpenAIClient } from "../../infrastructure/external/openai/openai-client";
import { ReceiptData, ReceiptScanResult } from "../../domain/receipts/receipts.types";
import { MAX_RECEIPT_FILE_SIZE } from "../../domain/receipts/receipts.constants";
import { validateImageFile } from "@/lib/utils/file-validation";
import { logger } from "@/src/infrastructure/utils/logger";

export class ReceiptsService {
  constructor(private openaiClient: OpenAIClient) {}

  /**
   * Scan a receipt image and extract transaction data
   */
  async scanReceipt(
    file: File,
    buffer: Buffer
  ): Promise<ReceiptScanResult> {
    try {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return {
          success: false,
          error: "File must be an image",
        };
      }

      // Validate file size
      if (file.size > MAX_RECEIPT_FILE_SIZE) {
        return {
          success: false,
          error: `File size exceeds maximum of ${MAX_RECEIPT_FILE_SIZE / 1024 / 1024}MB`,
        };
      }

      // Validate image file
      const validation = await validateImageFile(file, buffer);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || "Invalid image file",
        };
      }

      // Convert to base64
      const base64Image = buffer.toString("base64");
      const mimeType = file.type || "image/jpeg";

      // Extract receipt data using OpenAI
      const receiptData = await this.openaiClient.extractReceiptData(base64Image, mimeType);

      return {
        success: true,
        data: receiptData,
      };
    } catch (error) {
      logger.error("[ReceiptsService] Error scanning receipt:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scan receipt",
      };
    }
  }
}

