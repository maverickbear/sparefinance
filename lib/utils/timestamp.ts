import { format as dateFnsFormat } from "date-fns";

/**
 * Format a Date to PostgreSQL timestamp(3) without time zone format
 * Uses local date/time components to avoid timezone shifts
 * For dates (without time), use formatDateOnly instead
 * Example: "2024-01-01 12:00:00"
 */
export function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format a Date to PostgreSQL timestamp(3) without time zone format
 * For dates only (sets time to 00:00:00 in local timezone)
 * This ensures the date is saved exactly as the user selected, without timezone conversion
 * Example: "2024-01-02 00:00:00"
 */
export function formatDateOnly(date: Date): string {
  // Use local date components to ensure we save the exact date the user selected
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 00:00:00`;
}

/**
 * Format a Date for PostgreSQL queries (start of day)
 * Uses local date components to avoid timezone shifts
 * Example: "2024-01-01 00:00:00"
 */
export function formatDateStart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 00:00:00`;
}

/**
 * Format a Date for PostgreSQL queries (end of day)
 * Uses local date components to avoid timezone shifts
 * Example: "2024-01-01 23:59:59"
 */
export function formatDateEnd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 23:59:59`;
}

/**
 * Get current timestamp in PostgreSQL format
 */
export function getCurrentTimestamp(): string {
  return formatTimestamp(new Date());
}

/**
 * Parse a date string without timezone conversion
 * Handles formats like "2024-01-15" or "2024-01-15 12:00:00"
 * Returns a Date object in local timezone
 * 
 * CRITICAL: This function extracts ONLY the date part (YYYY-MM-DD) and creates
 * a Date object in the user's local timezone, ignoring any timezone information
 * from the string. This ensures dates are displayed exactly as stored.
 */
export function parseDateWithoutTimezone(dateStr: string | Date): Date {
  let year: number, month: number, day: number;
  
  if (dateStr instanceof Date) {
    // If it's already a Date, we need to extract the date components
    // The Date object might have been created from a UTC string, so we check
    // if it's a UTC date (has Z) or local date
    // To be safe, we extract using UTC methods and recreate in local timezone
    year = dateStr.getUTCFullYear();
    month = dateStr.getUTCMonth();
    day = dateStr.getUTCDate();
    
    // Recreate using local timezone to avoid any timezone shifts
    return new Date(year, month, day);
  }
  
  // Handle string formats
  const str = String(dateStr);
  
  // Extract just the date part (YYYY-MM-DD) if there's a time component
  // Handle formats like:
  // - "2024-01-15"
  // - "2024-01-15 12:00:00"
  // - "2024-01-15T12:00:00"
  // - "2024-01-15T12:00:00.000Z"
  // - "2024-01-15T00:00:00.000Z" (Supabase may return this)
  let dateOnly = str.split(' ')[0].split('T')[0];
  
  // Remove timezone suffix and milliseconds if present
  if (dateOnly.includes('Z')) {
    dateOnly = dateOnly.split('Z')[0];
  }
  if (dateOnly.includes('.')) {
    dateOnly = dateOnly.split('.')[0];
  }
  
  const dateParts = dateOnly.split('-');
  
  if (dateParts.length === 3) {
    year = parseInt(dateParts[0], 10);
    month = parseInt(dateParts[1], 10) - 1; // month is 0-indexed
    day = parseInt(dateParts[2], 10);
    
    // CRITICAL: Create date using local timezone constructor
    // new Date(year, monthIndex, day) creates date in local timezone at midnight
    // This ensures the date is exactly what the user selected, regardless of timezone
    const localDate = new Date(year, month, day);
    
    return localDate;
  }
  
  // Fallback: try to parse and extract date components
  // If the string has timezone info, we need to extract the date part first
  const fallbackDate = new Date(dateStr);
  if (!isNaN(fallbackDate.getTime())) {
    // Extract UTC components to get the actual date that was stored
    // Then recreate in local timezone
    year = fallbackDate.getUTCFullYear();
    month = fallbackDate.getUTCMonth();
    day = fallbackDate.getUTCDate();
    return new Date(year, month, day);
  }
  
  // Last resort: return current date
  console.warn('[parseDateWithoutTimezone] Unexpected date format:', dateStr);
  return new Date();
}

/**
 * Format date utilities using date-fns for consistent formatting across the app
 * All functions use parseDateWithoutTimezone to avoid timezone issues
 */

/**
 * Format a date for transaction display
 * Example: "Jan 15, 2024"
 */
export function formatTransactionDate(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMM dd, yyyy");
}

/**
 * Format a short date (month and day only)
 * Example: "Jan 15"
 */
export function formatShortDate(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMM dd");
}

/**
 * Format a long date with full month name
 * Example: "January 15, 2024"
 */
export function formatLongDate(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMMM dd, yyyy");
}

/**
 * Format a date with time for admin tables
 * Example: "Jan 15, 2024, 10:30 AM"
 */
export function formatDateTime(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMM dd, yyyy, h:mm a");
}

/**
 * Format a date for admin tables (date only, no time)
 * Example: "Jan 15, 2024"
 */
export function formatAdminDate(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMM dd, yyyy");
}

/**
 * Format a date with time (24h format)
 * Example: "Jan 15, 2024, 14:30"
 */
export function formatDateTime24h(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMM dd, yyyy, HH:mm");
}

/**
 * Format month and year
 * Example: "January 2024"
 */
export function formatMonthYear(date: string | Date): string {
  const parsedDate = parseDateWithoutTimezone(date);
  return dateFnsFormat(parsedDate, "MMMM yyyy");
}

/**
 * Parse a date string from HTML input type="date" (format: YYYY-MM-DD)
 * Creates a Date object in local timezone to avoid timezone shifts
 * This is critical: new Date("2024-01-02") creates UTC midnight, which can shift to previous day
 * 
 * @param dateString - Date string in YYYY-MM-DD format from HTML input
 * @returns Date object in local timezone at midnight
 */
export function parseDateInput(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }
  
  // Extract date components from YYYY-MM-DD format
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date in local timezone (not UTC)
  // new Date(year, monthIndex, day) creates date in local timezone at midnight
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object to YYYY-MM-DD string for HTML input type="date"
 * Uses local date components to avoid timezone shifts
 * 
 * @param date - Date object to format
 * @returns String in YYYY-MM-DD format
 */
export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }
  
  const parsedDate = parseDateWithoutTimezone(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

