import "server-only";
import type { DriveConnector, DriveFile } from "./types";
import { getAccessToken, isConnected as connCheck } from "./auth";
import { parseMonthYear, matchesYear, matchesMonth } from "./folder-match";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** List immediate children (files + subfolders) of a folder. */
async function listChildren(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const res = await fetch(
    `${API}/files?q=${q}&fields=files(id,name,mimeType)&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const body = (await res.json()) as { files?: DriveFile[] };
  return body.files ?? [];
}

const isFolder = (f: DriveFile) => f.mimeType === FOLDER_MIME;

/**
 * Resolve which folder actually holds this month's statement files, given the
 * folder the owner configured. Supports the mother → YEAR → MONTH layout:
 *   - configured folder has a "2026" subfolder → descend into it
 *   - inside, find the month subfolder ("June" / "06" / "2026-06")
 * Falls back gracefully: if the configured folder already contains files
 * directly (no year/month subfolders), use it as-is. Throws a clear error if a
 * year/month folder is expected but missing or ambiguous.
 */
export async function resolveMonthFolder(
  rootFolderId: string,
  monthYear: string,
): Promise<string> {
  const parsed = parseMonthYear(monthYear);
  const children = await listChildren(rootFolderId);
  const subfolders = children.filter(isFolder);
  const filesHere = children.filter((f) => !isFolder(f));

  // No subfolders at all → the configured folder is the month folder itself.
  if (subfolders.length === 0) return rootFolderId;

  // Can't parse the month → can't navigate; if files sit here use them, else error.
  if (!parsed) {
    if (filesHere.length > 0) return rootFolderId;
    throw new Error(`Invalid month "${monthYear}" and no files in the folder.`);
  }
  const { year, month } = parsed;

  // Step 1: descend into the YEAR folder if one exists.
  const yearFolders = subfolders.filter((f) => matchesYear(f.name, year));
  let monthSearchRoot = rootFolderId;
  let monthCandidates = subfolders;
  if (yearFolders.length === 1) {
    monthSearchRoot = yearFolders[0].id;
    monthCandidates = (await listChildren(monthSearchRoot)).filter(isFolder);
  } else if (yearFolders.length > 1) {
    throw new Error(`Multiple "${year}" folders found — please keep just one.`);
  }
  // (no year folder → look for the month directly under the configured folder)

  // Step 2: find the MONTH folder.
  const monthFolders = monthCandidates.filter((f) =>
    matchesMonth(f.name, month, year),
  );
  if (monthFolders.length === 1) return monthFolders[0].id;
  if (monthFolders.length > 1) {
    throw new Error(
      `Multiple folders match ${monthYear} — please keep one folder per month.`,
    );
  }

  // No month folder found. If the search root has files directly, use them
  // (e.g. owner pointed straight at the month folder). Otherwise, clear error.
  const rootFiles = (await listChildren(monthSearchRoot)).filter(
    (f) => !isFolder(f),
  );
  if (rootFiles.length > 0) return monthSearchRoot;
  throw new Error(
    `No folder for ${monthYear} found in Drive. Create a folder for that month.`,
  );
}

export const driveConnector: DriveConnector = {
  async isConnected() {
    return connCheck();
  },

  async listFiles(folderId: string): Promise<DriveFile[]> {
    return (await listChildren(folderId)).filter((f) => !isFolder(f));
  },

  async downloadFile(fileId: string): Promise<Buffer> {
    const token = await getAccessToken();
    const res = await fetch(`${API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  },
};
