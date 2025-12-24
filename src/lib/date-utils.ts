/**
 * Date utility functions for the LeaseSentinel cron job.
 * I use native Date methods to keep bundle size low and avoid unnecessary dependencies.
 */

/**
 * Gets today's date in ISO format (YYYY-MM-DD) using UTC.
 * I use UTC to avoid timezone fragmentation in the cron schedule - this ensures
 * the system fires consistently regardless of where the server is hosted
 * (e.g., Vercel US-East vs EU-West).
 * 
 * @returns Today's date as an ISO string in YYYY-MM-DD format.
 */
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Checks if two ISO date strings match exactly.
 * I use string comparison to avoid the complexity of Date object timestamps
 * (comparing 00:00 vs 23:59 can lead to off-by-one errors with timezones).
 * 
 * @param targetDate - The target date to check in YYYY-MM-DD format.
 * @param currentDate - The current date to compare against in YYYY-MM-DD format.
 * @returns True if the dates match exactly, false otherwise.
 */
export function isDateMatch(targetDate: string, currentDate: string): boolean {
  return targetDate === currentDate;
}
