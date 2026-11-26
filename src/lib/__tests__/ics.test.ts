import { describe, it, expect } from "vitest";
import { generateSentinelIcs, generateBulkIcs } from "../ics";
import type { Sentinel } from "@/models/schema";

const sampleSentinel: Sentinel = {
  id: "sentinel-abc",
  userId: "owner@example.com",
  eventName: "Renewal Notice, Suite 400; Building A",
  propertyLabel: "123 Main St, Suite 400",
  triggerDate: "2026-06-15",
  originalClause: "Tenant must give 60 days notice.\nMust be delivered in writing.",
  notificationMethod: "email",
  notificationTarget: "owner@example.com",
  status: "PENDING",
  leadTimeDays: [30, 7, 0],
  notifiedWindows: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ics generator", () => {
  it("generates a valid RFC 5545 single-event ICS with CRLF endings and VALARM blocks", () => {
    const ics = generateSentinelIcs(sampleSentinel);

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:-//LeaseSentinel//Lease Deadlines//EN\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("UID:sentinel-abc@leasesentinel.app\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260615\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260616\r\n");
    expect(ics).toContain("SUMMARY:Renewal Notice\\, Suite 400\\; Building A");
    expect(ics).toContain("LOCATION:123 Main St\\, Suite 400\r\n");
    expect(ics).toContain("TRIGGER:-P30D\r\n");
    expect(ics).toContain("TRIGGER:-P7D\r\n");
    expect(ics).toContain("TRIGGER:PT0S\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("generates a multi-event bulk ICS containing all provided sentinels", () => {
    const secondSentinel: Sentinel = {
      ...sampleSentinel,
      id: "sentinel-xyz",
      eventName: "Rent Escalation",
      propertyLabel: undefined,
      triggerDate: "2026-12-31",
      leadTimeDays: [14],
    };

    const ics = generateBulkIcs([sampleSentinel, secondSentinel]);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;

    expect(eventCount).toBe(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101\r\n");
    expect(ics).toContain("TRIGGER:-P14D\r\n");
  });
});
