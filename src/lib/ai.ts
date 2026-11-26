import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIExtractionSchema, type AIExtraction } from "@/models/schema";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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
