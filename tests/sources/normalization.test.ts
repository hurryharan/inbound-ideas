import { describe, expect, it } from "vitest";
import { parseLinkedInCsv, parseLinkedInJson } from "@/lib/sources/linkedin";
import { mapSheetRowsToItems } from "@/lib/sources/google-sheet";

describe("LinkedIn source normalization", () => {
  it("normalizes CSV rows into NormalizedItems", () => {
    const csv = `Title,Text,URL,Author,Date\n"UPI post","UPI wasn't really about payments",https://linkedin.com/posts/1,Jane Doe,2026-01-01`;
    const items = parseLinkedInCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "https://linkedin.com/posts/1",
      sourceType: "LINKEDIN_SAVED_POSTS",
      title: "UPI post",
      content: "UPI wasn't really about payments",
      author: "Jane Doe",
    });
    expect(items[0].createdAt).toBeInstanceOf(Date);
  });

  it("skips rows with no text content", () => {
    const csv = `Title,Text\nEmpty,`;
    expect(parseLinkedInCsv(csv)).toHaveLength(0);
  });

  it("falls back to a truncated content-based title when no title column", () => {
    const csv = `Text\nA fairly long observation about infrastructure and coordination costs disappearing over time.`;
    const items = parseLinkedInCsv(csv);
    expect(items[0].title.length).toBeLessThanOrEqual(80);
  });

  it("normalizes JSON array input", () => {
    const json = JSON.stringify([{ text: "Some saved post", url: "https://linkedin.com/posts/2" }]);
    const items = parseLinkedInJson(json);
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe("https://linkedin.com/posts/2");
  });

  it("normalizes JSON wrapped in an items/posts envelope", () => {
    const json = JSON.stringify({ posts: [{ text: "wrapped post" }] });
    const items = parseLinkedInJson(json);
    expect(items).toHaveLength(1);
  });
});

describe("Google Sheet source normalization", () => {
  const header = ["Title", "Idea", "Topic", "URL"];

  it("maps rows using configurable column mapping", () => {
    const rows = [["Enterprise AI", "A piece about enterprise AI adoption", "AI", "https://sheet.example.com/1"]];
    const items = mapSheetRowsToItems("sheet-1", "Ideas", header, rows, {
      title: "Title",
      body: "Idea",
      topic: "Topic",
      sourceUrl: "URL",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceType: "GOOGLE_SHEET",
      title: "Enterprise AI",
      content: "A piece about enterprise AI adoption",
      url: "https://sheet.example.com/1",
    });
    expect(items[0].externalId).toBe("sheet-1:Ideas:2");
  });

  it("remaps to different column names without code changes", () => {
    const remappedHeader = ["Content", "Category", "Reference URL"];
    const rows = [["Remapped content", "Governance", "https://sheet.example.com/2"]];
    const items = mapSheetRowsToItems("sheet-1", "Ideas", remappedHeader, rows, {
      title: "Content",
      body: "Content",
      topic: "Category",
      sourceUrl: "Reference URL",
    });
    expect(items[0].content).toBe("Remapped content");
    expect(items[0].metadata.topic).toBe("Governance");
  });

  it("skips rows with no title and no body", () => {
    const rows = [["", "", "", ""]];
    expect(mapSheetRowsToItems("sheet-1", "Ideas", header, rows, { title: "Title", body: "Idea" })).toHaveLength(0);
  });
});
