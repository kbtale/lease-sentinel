import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import type { NotificationMethod } from "@/models/schema";

export interface LookupAddress {
  address: string;
  family: number;
}

export type LookupFn = (
  hostname: string,
  options: { all: true }
) => Promise<LookupAddress[]>;

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const EMAIL_SCHEMA = z.string().trim().email("Please enter a valid email address");
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function expandIPv6(ip: string): number[] | null {
  const normalized = ip.toLowerCase().split("%")[0];
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4Part = normalized.slice(lastColon + 1);
    const ipv4Parts = ipv4Part.split(".").map(Number);
    if (ipv4Parts.length !== 4 || ipv4Parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16);
    const lo = ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16);
    return expandIPv6(`${normalized.slice(0, lastColon)}:${hi}:${lo}`);
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":").filter(Boolean) : [];

  if (halves.length === 1 && left.length !== 8) return null;
  if (left.length + right.length > 8) return null;

  const missing = 8 - (left.length + right.length);
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  const parsed = groups.map((g) => parseInt(g, 16));

  if (parsed.length !== 8 || parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) {
    return null;
  }
  return parsed;
}

export function isBlockedIp(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  const version = net.isIP(trimmed);

  if (version === 4) {
    return isBlockedIPv4(trimmed);
  }

  if (version === 6) {
    const groups = expandIPv6(trimmed);
    if (!groups) return true;

    const isAllZero = groups.every((g) => g === 0);
    if (isAllZero) return true;

    const isLoopback = groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1;
    if (isLoopback) return true;

    const isIpv4Mapped =
      groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
    if (isIpv4Mapped) {
      const a = (groups[6] >> 8) & 0xff;
      const b = groups[6] & 0xff;
      const c = (groups[7] >> 8) & 0xff;
      const d = groups[7] & 0xff;
      return isBlockedIPv4(`${a}.${b}.${c}.${d}`);
    }

    const first = groups[0];
    if ((first & 0xfe00) === 0xfc00) return true;
    if ((first & 0xffc0) === 0xfe80) return true;
    if ((first & 0xff00) === 0xff00) return true;

    return false;
  }

  return true;
}

const defaultLookup: LookupFn = async (hostname, options) => {
  return dnsLookup(hostname, options);
};

export async function validateWebhookUrl(
  rawUrl: string,
  lookupFn: LookupFn = defaultLookup
): Promise<ValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "Webhook URL must be a valid HTTPS URL" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Webhook URL must use HTTPS" };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "Webhook URL must not contain embedded credentials" };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    return { valid: false, reason: "Webhook host is not allowed" };
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { valid: false, reason: "Webhook target IP address is not allowed" };
    }
    return { valid: true };
  }

  try {
    const records = await lookupFn(hostname, { all: true });
    if (!records.length) {
      return { valid: false, reason: "Webhook host could not be resolved" };
    }
    for (const record of records) {
      if (isBlockedIp(record.address)) {
        return { valid: false, reason: "Webhook host resolves to a restricted IP address" };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "Webhook host could not be resolved" };
  }
}

export async function validateNotificationTarget(
  method: NotificationMethod,
  target: string,
  lookupFn: LookupFn = defaultLookup
): Promise<ValidationResult> {
  const trimmed = target.trim();
  if (!trimmed) {
    return { valid: false, reason: "Notification target is required" };
  }

  switch (method) {
    case "email": {
      const parsed = EMAIL_SCHEMA.safeParse(trimmed);
      if (!parsed.success) {
        return { valid: false, reason: "Please enter a valid email address" };
      }
      return { valid: true };
    }
    case "sms": {
      if (!E164_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason: "SMS target must be a valid E.164 phone number (e.g., +14155552671)",
        };
      }
      return { valid: true };
    }
    case "slack":
    case "custom":
      return validateWebhookUrl(trimmed, lookupFn);
  }
}
