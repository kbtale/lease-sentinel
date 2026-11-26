import { NextResponse } from "next/server";
import { extractMultipleLeaseDeadlines } from "@/lib/ai";
import { parseLeaseDocument } from "@/lib/document-parser";
import { addDaysISO, getTodayISO } from "@/lib/date-utils";
import type { ExtractedDeadline } from "@/models/schema";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const MAX_DEMO_TEXT_CHARS = 15_000;

const requestLog = new Map<string, number[]>();

export function resetDemoRateLimit() {
  requestLog.clear();
}

function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "anonymous";
}

function isRateLimited(clientKey: string, now: number): boolean {
  const recent = (requestLog.get(clientKey) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(clientKey, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(clientKey, recent);
  return false;
}

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function fallbackExtractDeadlines(text: string): ExtractedDeadline[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);

  const results: ExtractedDeadline[] = [];
  const monthDatePattern =
    /\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i;
  const isoPattern = /\b(\d{4}-\d{2}-\d{2})\b/;
  const priorDaysPattern = /(\d+)\s+days?\s+(?:prior|before)/i;

  for (const sentence of sentences) {
    let baseIso: string | null = null;
    const isoMatch = sentence.match(isoPattern);
    const monthMatch = sentence.match(monthDatePattern);

    if (isoMatch) {
      baseIso = isoMatch[1];
    } else if (monthMatch) {
      const month = MONTH_INDEX[monthMatch[1].toLowerCase()];
      const day = Number(monthMatch[2]);
      const year = Number(monthMatch[3]);
      if (month !== undefined && day >= 1 && day <= 31) {
        const dt = new Date(Date.UTC(year, month, day));
        if (dt.getUTCDate() === day) {
          baseIso = dt.toISOString().split("T")[0];
        }
      }
    }

    if (!baseIso) continue;

    const priorMatch = sentence.match(priorDaysPattern);
    const triggerDate = priorMatch
      ? addDaysISO(baseIso, -Number(priorMatch[1]))
      : baseIso;

    const lower = sentence.toLowerCase();
    const category: ExtractedDeadline["category"] = lower.includes("renew")
      ? "renewal"
      : lower.includes("terminat")
        ? "termination"
        : lower.includes("escalat") || lower.includes("increase")
          ? "escalation"
          : lower.includes("insur")
            ? "insurance"
            : lower.includes("inspect")
              ? "inspection"
              : lower.includes("rent") || lower.includes("deposit") || lower.includes("pay")
                ? "payment"
                : "other";

    const labelMap: Record<ExtractedDeadline["category"], string> = {
      renewal: "Lease Renewal Notice Deadline",
      termination: "Early Termination Notice Cutoff",
      escalation: "Scheduled Rent Escalation",
      insurance: "Insurance Certificate Renewal",
      inspection: "Property Inspection Deadline",
      payment: "Lease Payment / Deposit Milestone",
      other: "Lease Agreement Deadline",
    };

    results.push({
      eventName: labelMap[category],
      triggerDate,
      category,
      sourceQuote: sentence.slice(0, 260),
      suggestedLeadDays: [30, 7, 0],
    });
  }

  if (results.length === 0) {
    return [
      {
        eventName: "Lease Review Checkpoint",
        triggerDate: addDaysISO(getTodayISO(), 30),
        category: "other",
        sourceQuote: text.slice(0, 220),
        suggestedLeadDays: [30, 7, 0],
      },
    ];
  }

  return results;
}

export async function POST(req: Request): Promise<NextResponse> {
  const clientKey = getClientKey(req);
  if (isRateLimited(clientKey, Date.now())) {
    return NextResponse.json(
      { success: false, message: "Rate limit exceeded. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const uploadedFile = formData.get("file");
      if (uploadedFile && typeof uploadedFile === "object" && "arrayBuffer" in uploadedFile) {
        const file = uploadedFile as File;
        const parsed = await parseLeaseDocument({
          name: file.name,
          type: file.type,
          size: file.size,
          buffer: Buffer.from(await file.arrayBuffer()),
        });
        text = parsed.text;
      } else {
        const pasted = formData.get("text");
        if (typeof pasted === "string") {
          text = pasted;
        }
      }
    } else {
      const body = (await req.json()) as { text?: unknown };
      if (typeof body.text === "string") {
        text = body.text;
      }
    }

    const trimmed = text.trim();
    if (trimmed.length < 20) {
      return NextResponse.json(
        { success: false, message: "Please provide at least 20 characters of lease text." },
        { status: 400 }
      );
    }

    const bounded = trimmed.slice(0, MAX_DEMO_TEXT_CHARS);

    if (process.env.GOOGLE_API_KEY?.trim()) {
      const aiDeadlines = await extractMultipleLeaseDeadlines(bounded);
      if (aiDeadlines.length > 0) {
        return NextResponse.json({
          success: true,
          mode: "ai",
          deadlines: aiDeadlines,
        });
      }
    }

    const sampleDeadlines = fallbackExtractDeadlines(bounded);
    return NextResponse.json({
      success: true,
      mode: "sample",
      deadlines: sampleDeadlines,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to analyze lease text",
      },
      { status: 400 }
    );
  }
}
