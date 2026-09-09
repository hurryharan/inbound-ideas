import { describe, expect, it } from "vitest";
import { canonicalizeUrl, contentHash, dedupeBatch, isDuplicate, type ExistingKeys } from "@/lib/sources/dedup";

describe("contentHash", () => {
  it("is stable across whitespace and case differences", () => {
    expect(contentHash("Hello   World")).toBe(contentHash("hello world"));
  });

  it("differs for different content", () => {
    expect(contentHash("Hello World")).not.toBe(contentHash("Goodbye World"));
  });
});

describe("canonicalizeUrl", () => {
  it("strips tracking params and trailing slashes", () => {
    expect(canonicalizeUrl("https://Example.com/post/1/?utm_source=x&trk=y")).toBe("https://example.com/post/1");
  });

  it("returns null for empty input", () => {
    expect(canonicalizeUrl(undefined)).toBeNull();
  });
});

describe("isDuplicate / dedupeBatch", () => {
  const existing: ExistingKeys = {
    externalIds: new Set(["id-1"]),
    urls: new Set(["https://example.com/a"]),
    contentHashes: new Set([contentHash("existing content")]),
  };

  it("flags duplicates by externalId, canonical URL, or content hash", () => {
    expect(isDuplicate({ externalId: "id-1", contentHash: "whatever" }, existing)).toBe(true);
    expect(isDuplicate({ externalId: "new", url: "https://example.com/a?utm_source=z", contentHash: "whatever" }, existing)).toBe(true);
    expect(isDuplicate({ externalId: "new", contentHash: contentHash("existing content") }, existing)).toBe(true);
    expect(isDuplicate({ externalId: "new", contentHash: contentHash("brand new content") }, existing)).toBe(false);
  });

  it("dedupes a batch against existing items and against itself", () => {
    const batch = [
      { externalId: "a", url: "https://example.com/b", contentHash: contentHash("content b") },
      { externalId: "a-dup", url: "https://example.com/b", contentHash: contentHash("different content") }, // same URL as above
      { externalId: "id-1", contentHash: contentHash("irrelevant") }, // duplicate of existing externalId
      { externalId: "c", url: "https://example.com/c", contentHash: contentHash("content c") },
    ];

    const result = dedupeBatch(batch, existing);
    expect(result.map((r) => r.externalId)).toEqual(["a", "c"]);
  });

  it("keeps one item when separate tabs provide the same content under different URLs", () => {
    const result = dedupeBatch([
      { externalId: "processed:2", url: "https://example.com/processed", contentHash: contentHash("Same post body") },
      { externalId: "research:8", url: "https://example.com/research", contentHash: contentHash("Same post body") },
    ], { externalIds: new Set(), urls: new Set(), contentHashes: new Set() });

    expect(result.map((item) => item.externalId)).toEqual(["processed:2"]);
  });
});
