import { classifyFile, formatFileSize } from "@/app/[locale]/(routes)/chat/components/ChatFileAttachment";

describe("ChatFileAttachment - classifyFile", () => {
  it("correctly identifies PDF files", () => {
    const meta = classifyFile("report.pdf", "application/pdf");
    expect(meta.type).toBe("pdf");
    expect(meta.badge).toBe("PDF");
    expect(meta.label).toBe("PDF Document");
    expect(meta.accentColor).toContain("rose");
  });

  it("correctly identifies Word documents (.doc and .docx)", () => {
    const doc = classifyFile("proposal.doc", "application/msword");
    expect(doc.type).toBe("word");
    expect(doc.badge).toBe("DOC");
    expect(doc.label).toBe("Word Document");
    expect(doc.accentColor).toContain("blue");

    const docx = classifyFile("agreement.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(docx.type).toBe("word");
    expect(docx.badge).toBe("DOCX");
    expect(docx.label).toBe("Word Document");
  });

  it("correctly identifies Excel spreadsheets and CSVs", () => {
    const xlsx = classifyFile("financials.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(xlsx.type).toBe("excel");
    expect(xlsx.badge).toBe("XLS");
    expect(xlsx.label).toBe("Excel Spreadsheet");
    expect(xlsx.accentColor).toContain("emerald");

    const csv = classifyFile("contacts.csv", "text/csv");
    expect(csv.type).toBe("excel");
    expect(csv.badge).toBe("CSV");
    expect(csv.label).toBe("CSV Spreadsheet");
  });

  it("correctly identifies images and videos", () => {
    const img = classifyFile("screenshot.png", "image/png");
    expect(img.type).toBe("image");
    expect(img.badge).toBe("IMG");

    const vid = classifyFile("demo.mp4", "video/mp4");
    expect(vid.type).toBe("video");
    expect(vid.badge).toBe("VID");
  });

  it("formats file sizes cleanly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatFileSize(undefined)).toBe("");
  });
});
