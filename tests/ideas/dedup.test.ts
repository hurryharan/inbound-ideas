import { describe, expect, it } from "vitest";
import { contentHash } from "@/lib/sources/dedup";
import { findIdeaDuplicateGroups } from "@/lib/ideas/dedup";

const createdAt = new Date("2026-09-09T00:00:00Z");

describe("findIdeaDuplicateGroups", () => {
  it("groups ideas with tracking variants of the same source URL", () => {
    const groups = findIdeaDuplicateGroups([
      { id: "first", status: "SURFACED", createdAt, lastExploredAt: null, sourceItems: [{ sourceItem: { url: "https://example.com/post?utm_source=social", contentHash: contentHash("first") } }] },
      { id: "second", status: "SURFACED", createdAt: new Date("2026-09-10T00:00:00Z"), lastExploredAt: null, sourceItems: [{ sourceItem: { url: "https://example.com/post", contentHash: contentHash("second") } }] },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].keep.id).toBe("first");
    expect(groups[0].duplicates.map((idea) => idea.id)).toEqual(["second"]);
  });

  it("keeps the already-explored idea when content duplicates arrive later", () => {
    const hash = contentHash("Same underlying post");
    const groups = findIdeaDuplicateGroups([
      { id: "fresh", status: "SURFACED", createdAt, lastExploredAt: null, sourceItems: [{ sourceItem: { url: null, contentHash: hash } }] },
      { id: "explored", status: "EXPLORED", createdAt: new Date("2026-09-10T00:00:00Z"), lastExploredAt: new Date("2026-09-11T00:00:00Z"), sourceItems: [{ sourceItem: { url: null, contentHash: hash } }] },
    ]);

    expect(groups[0].keep.id).toBe("explored");
  });
});
