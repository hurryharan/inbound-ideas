import crypto from "crypto";

// Deduplication (PRD section 29/30): primarily by canonical URL / source ID,
// falling back to a content hash for exact/near-exact duplicates.

export function contentHash(content: string): string {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function canonicalizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    // strip common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "trk", "trackingId"].forEach(
      (p) => u.searchParams.delete(p)
    );
    let normalized = `${u.protocol}//${u.host}${u.pathname}${u.search}`;
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export interface DedupCandidate {
  externalId: string;
  url?: string | null;
  contentHash: string;
}

export interface ExistingKeys {
  externalIds: Set<string>;
  urls: Set<string>;
  contentHashes: Set<string>;
}

/** Returns true if `candidate` is a duplicate of something already known. */
export function isDuplicate(candidate: DedupCandidate, existing: ExistingKeys): boolean {
  if (existing.externalIds.has(candidate.externalId)) return true;
  const canonical = canonicalizeUrl(candidate.url);
  if (canonical && existing.urls.has(canonical)) return true;
  if (existing.contentHashes.has(candidate.contentHash)) return true;
  return false;
}

/** Deduplicates a batch of candidates against each other AND against existing keys. */
export function dedupeBatch<T extends DedupCandidate>(items: T[], existing: ExistingKeys): T[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (isDuplicate(item, existing)) continue;

    const canonical = canonicalizeUrl(item.url);
    if (seenIds.has(item.externalId)) continue;
    if (canonical && seenUrls.has(canonical)) continue;
    if (seenHashes.has(item.contentHash)) continue;

    seenIds.add(item.externalId);
    if (canonical) seenUrls.add(canonical);
    seenHashes.add(item.contentHash);
    result.push(item);
  }

  return result;
}
