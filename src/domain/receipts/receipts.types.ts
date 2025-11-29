/**
 * Domain types for receipts
 * Pure TypeScript types with no external dependencies
 */

export interface ReceiptData {
  amount?: number;
  merchant?: string;
  date?: string;
  description?: string;
  items?: Array<{ name: string; price: number }>;
}

export interface ReceiptScanResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
}

