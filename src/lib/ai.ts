import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Structured output from AI lease clause extraction.
 * 
 * @summary Result type containing parsed deadline data from natural language.
 * @category AI Extraction
 * 
 * @remarks
 * This interface defines the contract between the AI extraction layer and the
 * rest of the application. The AI is prompted to return JSON matching this shape,
 * which is then validated before use.
 * 
 * @see {@link extractLeaseData} for the function that produces this type.
 * @see {@link AIExtractionSchema} in `models/schema.ts` for Zod validation.
 */
interface ExtractionResult {
  /** Short descriptive name for the deadline (e.g., "Renewal Notice Deadline"). */
  eventName: string;
  /** ISO date string in YYYY-MM-DD format when the deadline fires. */
  triggerDate: string;
}

/**
 * Creates a Google Generative AI client instance.
 * 
 * @summary Factory function for Gemini API client initialization.
 * @category AI Extraction
 * @internal
 * 
 * @returns Configured GoogleGenerativeAI client.
 * @throws Error if `GOOGLE_API_KEY` environment variable is missing.
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Extracts structured lease deadline data from natural language text.
 * 
 * @summary Transforms raw lease clauses into machine-readable deadline objects using Gemini AI.
 * @category AI Extraction
 * 
 * @security
 * **No PII Storage**: The lease text is sent to Google's Gemini API for processing.
 * No text is persisted by this function—only the extracted structured data is returned.
 * 
 * @remarks
 * This function is the core of LeaseSentinel's intelligence. It:
 * 
 * 1. Injects today's date into the prompt for relative date calculation
 * 2. Configures Gemini to return JSON directly via `responseMimeType`
 * 3. Validates the response shape before returning
 * 
 * The AI handles complex natural language patterns like:
 * - "Tenant must provide 90 days notice before lease expiration"
 * - "Renewal option expires 6 months prior to term end"
 * - "Notice required by March 15, 2025"
 * 
 * @param text - Raw lease clause text containing date/deadline information.
 *   Should be at least a complete sentence for best extraction results.
 * 
 * @returns Promise resolving to {@link ExtractionResult} with `eventName` and 
 *   `triggerDate`, or `null` if extraction fails (invalid input, API error, 
 *   or malformed response).
 * 
 * @example
 * ```typescript
 * // Server Action usage
 * const result = await extractLeaseData(
 *   "Tenant must give 60 days written notice before the lease expires on Dec 31, 2025"
 * );
 * 
 * if (result) {
 *   console.log(result.eventName);    // "60-Day Notice Deadline"
 *   console.log(result.triggerDate);  // "2025-11-01"
 * }
 * ```
 * 
 * @see {@link createSentinel} in `sentinel.actions.ts` for the calling context.
 */
export async function extractLeaseData(
  text: string
): Promise<ExtractionResult | null> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: "gemini-1.5-flash",
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
    const response = result.response;
    const responseText = response.text();

    const parsed = JSON.parse(responseText) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "eventName" in parsed &&
      "triggerDate" in parsed &&
      typeof (parsed as ExtractionResult).eventName === "string" &&
      typeof (parsed as ExtractionResult).triggerDate === "string"
    ) {
      return parsed as ExtractionResult;
    }

    console.error("AI returned invalid response shape:", parsed);
    return null;
  } catch (error) {
    console.error("Failed to extract lease data:", error);
    return null;
  }
}
