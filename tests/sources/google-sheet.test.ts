import { describe, expect, it } from "vitest";
import { autoDetectColumnMapping, mapSheetRowsToItems, resolveColumnMapping } from "@/lib/sources/google-sheet";

describe("autoDetectColumnMapping (every Source is a sheet — this is what makes 'just paste a URL' work)", () => {
  it("detects the app's own default header names", () => {
    const mapping = autoDetectColumnMapping(["Title", "Idea", "Topic", "URL"]);
    expect(mapping).toMatchObject({ title: "Title", body: "Idea", topic: "Topic", sourceUrl: "URL" });
  });

  it("detects a LinkedIn-style export with different header names", () => {
    const mapping = autoDetectColumnMapping(["Title", "Text", "URL", "Author", "Date"]);
    expect(mapping).toMatchObject({ title: "Title", body: "Text", sourceUrl: "URL", author: "Author" });
  });

  it("detects common alternate aliases (Post/Link/Category)", () => {
    const mapping = autoDetectColumnMapping(["Post", "Link", "Category"]);
    expect(mapping).toMatchObject({ body: "Post", sourceUrl: "Link", topic: "Category" });
  });

  it("is case-insensitive", () => {
    const mapping = autoDetectColumnMapping(["TITLE", "content"]);
    expect(mapping).toMatchObject({ title: "TITLE", body: "content" });
  });

  it("leaves a field undefined when nothing in the header matches", () => {
    const mapping = autoDetectColumnMapping(["Timestamp", "Random Column"]);
    expect(mapping.title).toBeUndefined();
    expect(mapping.body).toBeUndefined();
  });
});

describe("resolveColumnMapping", () => {
  it("prefers an explicitly provided mapping over auto-detection (PRD section 12 — remap without a code change)", () => {
    const mapping = resolveColumnMapping(["Title", "Idea", "URL"], { body: "Title" });
    expect(mapping.body).toBe("Title"); // explicit override wins even though "Idea" would auto-detect
    expect(mapping.title).toBe("Title"); // untouched fields still auto-detect
  });

  it("falls back entirely to auto-detection when nothing is provided", () => {
    const mapping = resolveColumnMapping(["Title", "Content", "Link"]);
    expect(mapping).toMatchObject({ title: "Title", body: "Content", sourceUrl: "Link" });
  });
});

describe("mapSheetRowsToItems", () => {
  const header = ["Title", "Idea", "Topic", "URL"];

  it("maps rows using a resolved column mapping, with no sourceType field (every source is a sheet)", () => {
    const rows = [["Enterprise AI", "A piece about enterprise AI adoption", "AI", "https://sheet.example.com/1"]];
    const items = mapSheetRowsToItems("sheet-1", "Ideas", header, rows, {
      title: "Title",
      body: "Idea",
      topic: "Topic",
      sourceUrl: "URL",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Enterprise AI",
      content: "A piece about enterprise AI adoption",
      url: "https://sheet.example.com/1",
    });
    expect(items[0]).not.toHaveProperty("sourceType");
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

  it("extracts an author column when mapped", () => {
    const rows = [["A post", "Some content", "", "", "Jane Doe"]];
    const items = mapSheetRowsToItems("sheet-1", "Ideas", [...header, "Author"], rows, {
      title: "Title",
      body: "Idea",
      author: "Author",
    });
    expect(items[0].author).toBe("Jane Doe");
  });

  it("skips rows with no title and no body", () => {
    const rows = [["", "", "", ""]];
    expect(mapSheetRowsToItems("sheet-1", "Ideas", header, rows, { title: "Title", body: "Idea" })).toHaveLength(0);
  });
});
