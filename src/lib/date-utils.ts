/**
 * Date utility functions for LeaseSentinel cron job and deadline matching.
 * 
 * @remarks
 * This module provides timezone-safe date operations for the scheduler.
 * All functions use UTC to ensure consistent behavior regardless of
 * server deployment region (Vercel US-East vs EU-West, etc.).
 * 
 * Native `Date` methods are used intentionally to minimize bundle size
 * and avoid adding date library dependencies for simple operations.
 * 
 * @module
 * @category Utilities
 */

/**
 * Gets today's date in ISO format (YYYY-MM-DD) using UTC.
 * 
 * @summary Returns current UTC date as ISO string for consistent scheduling.
 * @category Utilities
 * 
 * @remarks
 * Uses UTC to avoid timezone fragmentation in the cron schedule. This ensures
 * the system fires consistently regardless of where the server is hosted.
 * 
 * For example, a deadline set for "2025-03-15" will fire at the same moment
 * globally, rather than firing at different times based on server timezone.
 * 
 * @returns Today's date as an ISO string in YYYY-MM-DD format.
 * 
 * @example
 * ```typescript
 * import { getTodayISO } from "@/lib/date-utils";
 * 
 * const today = getTodayISO();
 * // Returns: "2025-12-25"
 * ```
 */
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Checks if two ISO date strings match exactly.
 * 
 * @summary String-based date comparison to avoid timezone edge cases.
 * @category Utilities
 * 
 * @remarks
 * Uses string comparison rather than `Date` object comparison to avoid
 * the complexity of timestamp matching. Comparing `Date` objects representing
 * 00:00 vs 23:59 of the same day can lead to off-by-one errors with timezones.
 * 
 * Since all dates in LeaseSentinel are stored as YYYY-MM-DD strings, string
 * equality is both simpler and more reliable.
 * 
 * @param targetDate - The target date to check in YYYY-MM-DD format.
 * @param currentDate - The current date to compare against in YYYY-MM-DD format.
 * 
 * @returns `true` if the dates match exactly, `false` otherwise.
 * 
 * @example
 * ```typescript
 * import { isDateMatch } from "@/lib/date-utils";
 * 
 * isDateMatch("2025-03-15", "2025-03-15"); // true
 * isDateMatch("2025-03-15", "2025-03-16"); // false
 * ```
 */
export function isDateMatch(targetDate: string, currentDate: string): boolean {
  return targetDate === currentDate;
}

/**
 * Checks if a sentinel's trigger date falls within a notice window.
 * 
 * @summary Determines if a deadline is approaching within N days for early alerts.
 * @category Utilities
 * 
 * @remarks
 * Used to implement "Lead Time" notifications—alerting users when a deadline
 * is approaching within their specified notice window. For example, a 30-day
 * notice window would fire alerts for any sentinel with a `triggerDate` 
 * between today and 30 days from now.
 * 
 * The window is **inclusive** on both ends:
 * - `diffDays === 0` → deadline is today
 * - `diffDays === windowDays` → deadline is exactly at the edge of the window
 * 
 * @param triggerDate - The sentinel's trigger date in YYYY-MM-DD format.
 * @param todayDate - Today's date in YYYY-MM-DD format.
 * @param windowDays - The number of days in the notice window (e.g., 30 for 30-day notice).
 * 
 * @returns `true` if the trigger date is today or within `windowDays` from today (inclusive),
 *   `false` if the date is in the past or beyond the window.
 * 
 * @example
 * ```typescript
 * import { isWithinNoticeWindow } from "@/lib/date-utils";
 * 
 * // Today is 2025-03-01
 * isWithinNoticeWindow("2025-03-15", "2025-03-01", 30); // true (14 days away)
 * isWithinNoticeWindow("2025-04-15", "2025-03-01", 30); // false (45 days away)
 * isWithinNoticeWindow("2025-02-28", "2025-03-01", 30); // false (in the past)
 * ```
 */
export function isWithinNoticeWindow(
  triggerDate: string,
  todayDate: string,
  windowDays: number
): boolean {
  const trigger = new Date(triggerDate);
  const today = new Date(todayDate);
  
  const diffMs = trigger.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 && diffDays <= windowDays;
}
