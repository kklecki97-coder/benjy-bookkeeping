import "server-only";
import type { DriveConnector, DriveFile } from "./types";
import { getAccessToken, isConnected as connCheck } from "./auth";

const API = "https://www.googleapis.com/drive/v3";

export const driveConnector: DriveConnector = {
  async isConnected() {
    return connCheck();
  },

  async listFiles(folderId: string): Promise<DriveFile[]> {
    const token = await getAccessToken();
    const q = encodeURIComponent(
      `'${folderId}' in parents and trashed = false`,
    );
    const res = await fetch(
      `${API}/files?q=${q}&fields=files(id,name,mimeType)&pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
    const body = (await res.json()) as { files?: DriveFile[] };
    return body.files ?? [];
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
