import mammoth from "mammoth";
import { extractText } from "unpdf";

export const MAX_LEASE_FILE_BYTES = 10 * 1024 * 1024;

export type SupportedLeaseFileType = "pdf" | "docx" | "txt";

export interface LeaseDocumentInput {
  name: string;
  type?: string;
  size?: number;
  buffer: Buffer;
}

export interface ParsedLeaseDocument {
  text: string;
  fileName: string;
  fileType: SupportedLeaseFileType;
  characterCount: number;
}

const EXTENSION_MAP: Record<string, SupportedLeaseFileType> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
};

const ALLOWED_MIME_TYPES: Record<SupportedLeaseFileType, Set<string>> = {
  pdf: new Set(["application/pdf", "application/x-pdf", "application/octet-stream", ""]),
  docx: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "",
  ]),
  txt: new Set(["text/plain", "application/octet-stream", ""]),
};

function detectFileType(fileName: string, mimeType?: string): SupportedLeaseFileType {
  const lowerName = fileName.trim().toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");
  const ext = dotIndex >= 0 ? lowerName.slice(dotIndex) : "";
  const fileType = EXTENSION_MAP[ext];

  if (!fileType) {
    throw new Error("Unsupported file type. Please upload a .pdf, .docx, or .txt lease.");
  }

  const normalizedMime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (normalizedMime && !ALLOWED_MIME_TYPES[fileType].has(normalizedMime)) {
    throw new Error(`Unsupported MIME type (${normalizedMime}) for .${fileType} file.`);
  }

  return fileType;
}

function normalizeExtractedText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

export async function parseLeaseDocument(
  input: LeaseDocumentInput
): Promise<ParsedLeaseDocument> {
  const byteSize = input.size ?? input.buffer.byteLength;
  if (byteSize === 0 || input.buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (byteSize > MAX_LEASE_FILE_BYTES || input.buffer.byteLength > MAX_LEASE_FILE_BYTES) {
    throw new Error("File exceeds 10MB limit.");
  }

  const fileType = detectFileType(input.name, input.type);
  let rawText = "";

  if (fileType === "txt") {
    rawText = input.buffer.toString("utf8");
  } else if (fileType === "pdf") {
    const extracted = await extractText(new Uint8Array(input.buffer), {
      mergePages: true,
    });
    rawText = Array.isArray(extracted.text)
      ? extracted.text.join("\n")
      : extracted.text;
  } else if (fileType === "docx") {
    const extracted = await mammoth.extractRawText({ buffer: input.buffer });
    rawText = extracted.value;
  }

  const normalized = normalizeExtractedText(rawText);
  if (!normalized) {
    throw new Error("Document contains no readable text.");
  }

  return {
    text: normalized,
    fileName: input.name,
    fileType,
    characterCount: normalized.length,
  };
}
