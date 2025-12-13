/**
 * Receipts Service
 * Business logic for receipt management
 * 
 * SIMPLIFIED: Separated Core (upload) from Experimental (AI extraction)
 * AI extraction is now optional via feature flag
 */

import { OpenAIClient } from "@/src/infrastructure/external/openai/openai-client";
import { ReceiptsRepository } from "@/src/infrastructure/database/repositories/receipts.repository";
import { ReceiptData, ReceiptScanResult } from "../../domain/receipts/receipts.types";
import { MAX_RECEIPT_FILE_SIZE } from "../../domain/receipts/receipts.constants";
import { validateImageFile } from "@/lib/utils/file-validation";
import { logger } from "@/src/infrastructure/utils/logger";

// Feature flag for AI extraction (experimental)
const RECEIPTS_AI_ENABLED = process.env.ENABLE_RECEIPTS_AI === 'true';

export class ReceiptsService {
  constructor(
    private openaiClient: OpenAIClient,
    private receiptsRepository: ReceiptsRepository
  ) {}

  /**
   * Upload receipt file to storage (CORE - always works)
   * SIMPLIFIED: Core functionality separated from AI extraction
   */
  async uploadReceipt(
    userId: string,
    file: File,
    buffer: Buffer
  ): Promise<{ receiptUrl: string; receiptPath: string }> {
    try {
      // Validate file type (images and PDFs)
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      
      if (!isImage && !isPdf) {
        throw new Error("File must be an image or PDF");
      }

      // Validate file size
      if (file.size > MAX_RECEIPT_FILE_SIZE) {
        throw new Error(`File size exceeds maximum of ${MAX_RECEIPT_FILE_SIZE / 1024 / 1024}MB`);
      }

      // Validate image file (skip validation for PDFs)
      if (isImage) {
        const validation = await validateImageFile(file, buffer, MAX_RECEIPT_FILE_SIZE);
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid image file");
        }
      }

      // Save file to Supabase Storage
      const uploadResult = await this.receiptsRepository.uploadReceipt(userId, file, buffer);
      logger.log("[ReceiptsService] Receipt file saved to storage:", uploadResult.path);

      return {
        receiptUrl: uploadResult.url,
        receiptPath: uploadResult.path,
      };
    } catch (error) {
      logger.error("[ReceiptsService] Error uploading receipt:", error);
      throw error;
    }
  }

  /**
   * Extract receipt data using AI (EXPERIMENTAL - optional, feature flag)
   * SIMPLIFIED: AI extraction is now optional and separated from upload
   */
  async extractReceiptData(
    receiptPath: string,
    file: File,
    buffer: Buffer
  ): Promise<ReceiptData> {
    // Check feature flag
    if (!RECEIPTS_AI_ENABLED) {
      throw new Error("AI extraction is not enabled. Set ENABLE_RECEIPTS_AI=true to enable.");
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured. Receipt extraction requires AI.");
    }

    try {
      // Only images can be scanned with Vision API
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        return {
          amount: undefined,
          merchant: undefined,
          date: undefined,
          description: undefined,
          items: undefined,
        };
      }

      // Convert to base64 for OpenAI Vision API
      const base64Image = buffer.toString("base64");
      const mimeType = file.type || "image/jpeg";

      // Extract receipt data using OpenAI
      const receiptData = await this.openaiClient.extractReceiptData(base64Image, mimeType);

      return receiptData;
    } catch (error) {
      logger.error("[ReceiptsService] Error extracting receipt data:", error);
      throw error;
    }
  }

  /**
   * Scan a receipt image and extract transaction data
   * Also saves the file to Supabase Storage
   * 
   * @deprecated This method combines upload + extract. 
   * Use uploadReceipt() + extractReceiptData() separately for better control.
   * Kept for backward compatibility.
   */
  async scanReceipt(
    userId: string,
    file: File,
    buffer: Buffer
  ): Promise<ReceiptScanResult> {
    try {
      // Upload receipt (core - always works)
      const { receiptUrl, receiptPath } = await this.uploadReceipt(userId, file, buffer);

      // Try AI extraction if enabled (experimental - optional)
      let receiptData: ReceiptData | undefined;
      if (RECEIPTS_AI_ENABLED) {
        try {
          receiptData = await this.extractReceiptData(receiptPath, file, buffer);
        } catch (extractError) {
          logger.warn("[ReceiptsService] AI extraction failed, but upload succeeded:", extractError);
          // Continue without extracted data (upload still succeeded)
        }
      }

      return {
        success: true,
        data: receiptData || {
          amount: undefined,
          merchant: undefined,
          date: undefined,
          description: undefined,
          items: undefined,
        },
        receiptUrl,
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

