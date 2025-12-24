import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Result type for AI extraction - null indicates extraction failed.
 */
interface ExtractionResult {
  eventName: string;
  triggerDate: string;
}

/**
 * Creates a Google Generative AI client instance.
 * 
 * @returns Configured GoogleGenerativeAI client.
 * @throws Error if GOOGLE_API_KEY environment variable is missing.
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Extracts structured lease deadline data from natural language text using Gemini AI.
 * I inject today's date into the prompt so the AI can calculate relative time references
 * (e.g., "6 months before expiration") into absolute ISO dates.
 * 
 * @param text - Raw lease clause text containing date/deadline information.
 * @returns Promise resolving to extracted event name and trigger date, or null if extraction fails.
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

    // I inject today's date so AI can calculate relative dates like "6 months before expiration"
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

    // Validate the parsed response has the expected shape
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
