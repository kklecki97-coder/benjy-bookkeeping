/**
 * Google Drive connector interface — SCAFFOLD.
 *
 * Implementation (OAuth + fetch) is wired up once the integration method is
 * confirmed with the client. Three options on the table:
 *   1. OAuth + Folder ID — user connects Drive, pastes a folder ID. (simplest)
 *   2. OAuth + Google Picker — native file picker each run.
 *   3. Service Account — folder shared with a service account email.
 *
 * The interface below is method-agnostic so the orchestrator and UI don't
 * change when we pick one. See docs/DRIVE_INTEGRATION.md for the wiring TODO.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveConnector {
  /** Whether Drive is connected (token present). */
  isConnected(): Promise<boolean>;
  /** List files in the configured monthly folder. */
  listFiles(folderId: string): Promise<DriveFile[]>;
  /** Download a file's bytes by id. */
  downloadFile(fileId: string): Promise<Buffer>;
}
