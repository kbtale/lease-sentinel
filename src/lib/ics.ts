import type { Sentinel } from "@/models/schema";
import { addDaysISO } from "@/lib/date-utils";

export interface IcsEventInput {
  id?: string;
  eventName: string;
  triggerDate: string;
  originalClause: string;
  propertyLabel?: string;
  leadTimeDays?: number[];
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let offset = 75;
  while (offset < line.length) {
    chunks.push(` ${line.slice(offset, offset + 74)}`);
    offset += 74;
  }
  return chunks.join("\r\n");
}

function formatIcsDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function formatUtcTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function buildAlarmLines(days: number, summary: string): string[] {
  const trigger = days === 0 ? "PT0S" : `-P${days}D`;
  const description =
    days === 0
      ? `Lease deadline today: ${summary}`
      : `Lease deadline in ${days} days: ${summary}`;

  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:${trigger}`,
    foldIcsLine(`DESCRIPTION:${escapeIcsText(description)}`),
    "END:VALARM",
  ];
}

function buildEventLines(item: IcsEventInput, dtStamp: string, index: number): string[] {
  const uidBase = (item.id || `lease-deadline-${index}-${item.triggerDate}`).replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );
  const startDate = formatIcsDate(item.triggerDate);
  const endDate = formatIcsDate(addDaysISO(item.triggerDate, 1));
  const summary = item.eventName.trim();
  const descriptionParts = [
    item.propertyLabel ? `Property: ${item.propertyLabel}` : null,
    `Deadline Date: ${item.triggerDate}`,
    `Clause: ${item.originalClause}`,
  ].filter(Boolean);

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${uidBase}@leasesentinel.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`),
    "STATUS:CONFIRMED",
  ];

  if (item.propertyLabel) {
    lines.push(foldIcsLine(`LOCATION:${escapeIcsText(item.propertyLabel)}`));
  }

  const leadTimes =
    Array.isArray(item.leadTimeDays) && item.leadTimeDays.length > 0
      ? Array.from(new Set(item.leadTimeDays)).sort((a, b) => b - a)
      : [30, 7, 0];

  for (const days of leadTimes) {
    lines.push(...buildAlarmLines(days, summary));
  }

  lines.push("END:VEVENT");
  return lines;
}

export function generateBulkIcs(items: Array<Sentinel | IcsEventInput>): string {
  const dtStamp = formatUtcTimestamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeaseSentinel//Lease Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  items.forEach((item, index) => {
    lines.push(...buildEventLines(item, dtStamp, index));
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function generateSentinelIcs(sentinel: Sentinel | IcsEventInput): string {
  return generateBulkIcs([sentinel]);
}
