import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExtractText = vi.fn();
const mockExtractRawText = vi.fn();

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText: (...args: unknown[]) => mockExtractRawText(...args),
  },
  extractRawText: (...args: unknown[]) => mockExtractRawText(...args),
}));

import { parseLeaseDocument, MAX_LEASE_FILE_BYTES } from "../document-parser";

describe("document-parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text from UTF-8 TXT files", async () => {
    const buffer = Buffer.from(
      "Tenant must give 60 days written notice prior to December 31, 2026.",
      "utf8"
    );

    const result = await parseLeaseDocument({
      name: "lease.txt",
      type: "text/plain",
      buffer,
    });

    expect(result.fileType).toBe("txt");
    expect(result.text).toContain("60 days written notice");
    expect(result.characterCount).toBeGreaterThan(20);
  });

  it("extracts text from PDF files using unpdf", async () => {
    mockExtractText.mockResolvedValueOnce({
      totalPages: 2,
      text: "Renewal notice due 90 days before September 30, 2026.",
    });

    const result = await parseLeaseDocument({
      name: "commercial-lease.pdf",
      type: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake content"),
    });

    expect(result.fileType).toBe("pdf");
    expect(result.text).toContain("Renewal notice due 90 days");
    expect(mockExtractText).toHaveBeenCalledOnce();
  });

  it("extracts text from DOCX files using mammoth", async () => {
    mockExtractRawText.mockResolvedValueOnce({
      value: "Annual rent escalation of 3% effective January 1, 2027.",
    });

    const result = await parseLeaseDocument({
      name: "agreement.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK fake docx bytes"),
    });

    expect(result.fileType).toBe("docx");
    expect(result.text).toContain("Annual rent escalation");
    expect(mockExtractRawText).toHaveBeenCalledOnce();
  });

  it("rejects files larger than 10MB", async () => {
    const oversized = Buffer.alloc(MAX_LEASE_FILE_BYTES + 1, 65);

    await expect(
      parseLeaseDocument({
        name: "huge-lease.txt",
        type: "text/plain",
        buffer: oversized,
      })
    ).rejects.toThrow(/10MB/i);
  });

  it("rejects unsupported file extensions", async () => {
    await expect(
      parseLeaseDocument({
        name: "malware.exe",
        type: "application/octet-stream",
        buffer: Buffer.from("MZ"),
      })
    ).rejects.toThrow(/unsupported/i);
  });

  it("rejects documents with no readable text", async () => {
    await expect(
      parseLeaseDocument({
        name: "empty.txt",
        type: "text/plain",
        buffer: Buffer.from("   \n\t  "),
      })
    ).rejects.toThrow(/no readable text/i);
  });
});
