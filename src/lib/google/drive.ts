import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google/oauth";

// Google Drive connector (PRD section 11) used by the Context layer. Read-only.

export interface DriveDocumentContent {
  fileId: string;
  title: string;
  content: string;
  url: string;
}

const EXPORTABLE_DOC_MIME = "application/vnd.google-apps.document";
const EXPORTABLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";

export function extractDriveFileId(urlOrId: string): string {
  const folderMatch = urlOrId.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fileMatch) return fileMatch[1];
  const idParam = urlOrId.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idParam) return idParam[1];
  return urlOrId.trim();
}

export async function fetchDriveDocument(userId: string, fileId: string): Promise<DriveDocumentContent> {
  const auth = await getGoogleAuthClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const meta = await drive.files.get({ fileId, fields: "id,name,mimeType,webViewLink" });
  const mimeType = meta.data.mimeType;

  let content = "";
  if (mimeType === EXPORTABLE_DOC_MIME) {
    const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
    content = String(res.data);
  } else if (mimeType === EXPORTABLE_SHEET_MIME) {
    const res = await drive.files.export({ fileId, mimeType: "text/csv" }, { responseType: "text" });
    content = String(res.data);
  } else {
    // Fall back to downloading raw content for plain-text-ish files.
    try {
      const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
      content = String(res.data);
    } catch {
      content = "";
    }
  }

  return {
    fileId,
    title: meta.data.name ?? fileId,
    // Postgres text columns reject null bytes; the raw-content fallback
    // above can pull in binary files (PDFs, images) that contain them.
    content: content.split(String.fromCharCode(0)).join(""),
    url: meta.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function listFolderChildren(
  drive: ReturnType<typeof google.drive>,
  folderId: string
): Promise<{ id: string; name: string; mimeType: string }[]> {
  const files: { id: string; name: string; mimeType: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name && f.mimeType) files.push({ id: f.id, name: f.name, mimeType: f.mimeType });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/** Recursively lists every file under a folder, descending into subfolders. */
export async function listDriveFolderFiles(
  userId: string,
  folderId: string
): Promise<{ id: string; name: string; mimeType: string }[]> {
  const auth = await getGoogleAuthClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const files: { id: string; name: string; mimeType: string }[] = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentFolderId = queue.shift()!;
    const children = await listFolderChildren(drive, currentFolderId);
    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        queue.push(child.id);
      } else {
        files.push(child);
      }
    }
  }

  return files;
}

export async function fetchDriveFolderDocuments(
  userId: string,
  folderId: string
): Promise<DriveDocumentContent[]> {
  const files = await listDriveFolderFiles(userId, folderId);
  const documents: DriveDocumentContent[] = [];
  for (const file of files) {
    try {
      documents.push(await fetchDriveDocument(userId, file.id));
    } catch {
      // Skip files we can't export (images, unsupported binary types, etc).
    }
  }
  return documents;
}
