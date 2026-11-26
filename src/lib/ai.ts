import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIExtractionSchema,
  ExtractedDeadlineSchema,
  type AIExtraction,
  type ExtractedDeadline,
} from "@/models/schema";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MAX_MULTI_EXTRACTION_CHARS = 60000;

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable");
  }

  return new GoogleGenerativeAI(apiKey);
}

function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export async function extractLeaseData(
  text: string
): Promise<AIExtraction | null> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: getGeminiModelName(),
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const todayISO = new Date().toISOString();

    const prompt = `You are a lease administrator. Extract the event name and the deadline date from the text. Return JSON.

Today's Date: ${todayISO}

IMPORTANT RULES:
- If the text mentions a relative date (e.g., "6 months before expiration"), calculate the ISO date based on Today's Date above.
- Always return the trigger date in YYYY-MM-DD format.
- If no specific date can be determined, use today's date + 30 days as default.

Lease clause to analyze:
"${text}"

Respond with a JSON object containing exactly these fields:
{
  "eventName": "short descriptive name for the deadline",
  "triggerDate": "YYYY-MM-DD"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed: unknown = JSON.parse(responseText);
    const validated = AIExtractionSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }

    console.error("AI returned invalid response shape:", parsed);
    return null;
  } catch (error) {
    console.error("Failed to extract lease data:", error);
    return null;
  }
}

export async function extractMultipleLeaseDeadlines(
  text: string
): Promise<ExtractedDeadline[]> {
  try {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    const truncated = trimmed.slice(0, MAX_MULTI_EXTRACTION_CHARS);
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: getGeminiModelName(),
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const todayISO = new Date().toISOString().split("T")[0];

    const prompt = `You are an expert commercial and residential lease administrator.
Analyze the full lease document below and extract EVERY actionable deadline or notice date (renewals, termination notice cutoffs, rent escalations, option windows, insurance certificate renewals, inspection dates, security deposit / key payment dates).

Today's Date: ${todayISO}

RULES:
- Calculate relative dates (e.g., "90 days prior to December 31, 2026") into exact YYYY-MM-DD calendar dates.
- Category must be one of: "renewal", "termination", "escalation", "payment", "inspection", "insurance", "other".
- Include a concise exact sourceQuote from the lease for each deadline.
- Provide suggestedLeadDays as an array of integers (e.g. [30, 7, 0]).
- Only include deadlines that have a concrete or calculable calendar date.

Lease Document:
"""
${truncated}
"""

Respond strictly with JSON matching this shape:
{
  "deadlines": [
    {
      "eventName": "Short descriptive title",
      "triggerDate": "YYYY-MM-DD",
      "category": "renewal",
      "sourceQuote": "Verbatim sentence or clause excerpt",
      "suggestedLeadDays": [30, 7, 0]
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed: unknown = JSON.parse(responseText);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("deadlines" in parsed) ||
      !Array.isArray((parsed as { deadlines: unknown }).deadlines)
    ) {
      return [];
    }

    const rawDeadlines = (parsed as { deadlines: unknown[] }).deadlines;
    const validDeadlines: ExtractedDeadline[] = [];

    for (const item of rawDeadlines) {
      const checked = ExtractedDeadlineSchema.safeParse(item);
      if (checked.success) {
        validDeadlines.push(checked.data);
      }
    }

    return validDeadlines;
  } catch (error) {
    console.error("Failed to extract multiple lease deadlines:", error);
    return [];
  }
}
