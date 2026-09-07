import type { Source } from "@prisma/client";
import type { GoogleSheetSourceConfig, NormalizedItem } from "./types";
import { fetchGoogleSheetItems } from "./google-sheet";
import { fetchDriveDocument, fetchDriveFolderDocuments } from "@/lib/google/drive";

/**
 * Fetches normalized items for any pull-based Source (PRD section 14/29).
 * LinkedIn is push/import-based (see /api/sources/[id]/import) and has no
 * fetch step here — refreshing it is a no-op.
 */
export async function fetchNormalizedItems(userId: string, source: Source): Promise<NormalizedItem[]> {
  switch (source.type) {
    case "GOOGLE_SHEET":
      return fetchGoogleSheetItems(userId, source.config as unknown as GoogleSheetSourceConfig);

    case "GOOGLE_DRIVE_DOCUMENT": {
      const config = source.config as { fileId: string };
      const doc = await fetchDriveDocument(userId, config.fileId);
      return [
        {
          externalId: doc.fileId,
          sourceType: source.type,
          title: doc.title,
          content: doc.content,
          url: doc.url,
          createdAt: new Date(),
          metadata: {},
        },
      ];
    }

    case "GOOGLE_DRIVE_FOLDER": {
      const config = source.config as { folderId: string };
      const docs = await fetchDriveFolderDocuments(userId, config.folderId);
      return docs.map((doc) => ({
        externalId: doc.fileId,
        sourceType: source.type,
        title: doc.title,
        content: doc.content,
        url: doc.url,
        createdAt: new Date(),
        metadata: {},
      }));
    }

    case "LINKEDIN_SAVED_POSTS":
      return [];

    default:
      return [];
  }
}
