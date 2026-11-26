export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function isDateMatch(targetDate: string, currentDate: string): boolean {
  return targetDate === currentDate;
}

export function daysUntil(triggerDate: string, todayDate: string): number {
  const trigger = new Date(`${triggerDate}T00:00:00.000Z`);
  const today = new Date(`${todayDate}T00:00:00.000Z`);
  const diffMs = trigger.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

export function isWithinNoticeWindow(
  triggerDate: string,
  todayDate: string,
  windowDays: number
): boolean {
  const diffDays = daysUntil(triggerDate, todayDate);
  return diffDays >= 0 && diffDays <= windowDays;
}

export function getDueReminderWindow(
  triggerDate: string,
  todayDate: string,
  leadTimeDays: number[],
  notifiedWindows: number[]
): number | null {
  const remainingDays = daysUntil(triggerDate, todayDate);
  const windows = leadTimeDays.length > 0 ? leadTimeDays : [0];

  if (remainingDays <= 0) {
    if (notifiedWindows.includes(0)) {
      return null;
    }
    return 0;
  }

  const matchingWindows = windows
    .filter((w) => w > 0 && remainingDays <= w && !notifiedWindows.includes(w))
    .sort((a, b) => a - b);

  if (matchingWindows.length === 0) {
    return null;
  }

  return matchingWindows[0];
}
