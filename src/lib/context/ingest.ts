import { prisma } from "@/lib/prisma";
import { fetchDriveDocument, fetchDriveFolderDocuments } from "@/lib/google/drive";
import type { ContextSource } from "@prisma/client";

/**
 * Refreshes a ContextSource's documents from Google Drive (PRD section 11:
 * "the app should periodically refresh/index configured sources"). Content
 * is a plain-text/CSV snapshot — good enough for the MVP's tag-based
 * matching (section 20); a future version can chunk + embed instead.
 */
export async function refreshContextSource(userId: string, contextSource: ContextSource): Promise<number> {
  const config = contextSource.externalId;

  const docs =
    contextSource.type === "GOOGLE_DRIVE_FOLDER"
      ? await fetchDriveFolderDocuments(userId, config)
      : [await fetchDriveDocument(userId, config)];

  for (const doc of docs) {
    await prisma.contextDocument.upsert({
      where: { contextSourceId_externalId: { contextSourceId: contextSource.id, externalId: doc.fileId } },
      update: { title: doc.title, content: doc.content, url: doc.url },
      create: {
        contextSourceId: contextSource.id,
        externalId: doc.fileId,
        title: doc.title,
        content: doc.content,
        url: doc.url,
        tags: contextSource.tags,
      },
    });
  }

  await prisma.contextSource.update({ where: { id: contextSource.id }, data: { lastIndexedAt: new Date() } });

  return docs.length;
}
