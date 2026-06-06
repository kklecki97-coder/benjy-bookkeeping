import "server-only";
import type { DriveConnector, DriveFile } from "./types";

/**
 * SCAFFOLD implementation. Methods throw "not configured" until the Google
 * Drive integration is wired up (OAuth + fetch). This keeps the orchestrator
 * and UI buildable now; we flip the implementation on once the client confirms
 * the integration method.
 *
 * To wire up (OAuth + Folder ID path):
 *  1. Create a Google Cloud project + OAuth client (Drive API scope:
 *     https://www.googleapis.com/auth/drive.readonly).
 *  2. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI to env.
 *  3. Implement /api/drive/connect + /api/drive/callback (mirror the QBO flow
 *     in lib/qbo/oauth.ts — store encrypted refresh token in drive_connection).
 *  4. Implement listFiles/downloadFile via the Drive v3 REST API:
 *       GET /drive/v3/files?q='<folderId>' in parents
 *       GET /drive/v3/files/{id}?alt=media
 */
const NOT_CONFIGURED =
  "Google Drive is not connected yet. Use file upload, or connect Drive in Settings.";

export const driveConnector: DriveConnector = {
  async isConnected() {
    return false; // flip once token storage exists
  },
  async listFiles(_folderId: string): Promise<DriveFile[]> {
    throw new Error(NOT_CONFIGURED);
  },
  async downloadFile(_fileId: string): Promise<Buffer> {
    throw new Error(NOT_CONFIGURED);
  },
};
