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

/**
 * Checks if a sentinel's trigger date falls within N days of today.
 * Used to determine if a "notice window" alert should fire - for example,
 * alerting a user when a lease deadline is approaching within their specified window.
 * 
 * @param triggerDate - The sentinel's trigger date in YYYY-MM-DD format.
 * @param todayDate - Today's date in YYYY-MM-DD format.
 * @param windowDays - The number of days in the notice window (e.g., 30 for 30-day notice).
 * @returns True if the trigger date is today or within windowDays from today (inclusive).
 */
export function isWithinNoticeWindow(
  triggerDate: string,
  todayDate: string,
  windowDays: number
): boolean {
  const trigger = new Date(triggerDate);
  const today = new Date(todayDate);
  
  // Calculate difference in days (trigger > today means future date)
  const diffMs = trigger.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  // True if trigger is today (0 days) or within windowDays ahead (inclusive)
  return diffDays >= 0 && diffDays <= windowDays;
}
