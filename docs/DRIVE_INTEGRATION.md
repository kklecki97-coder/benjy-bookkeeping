# Google Drive Integration — Wiring Guide

**Status: SCAFFOLD.** The interface, orchestration path, and UI placeholder exist.
Manual file upload works today. Auto-pull from Drive is wired up once the client
confirms the integration method.

## What's already built

- `lib/drive/types.ts` — `DriveConnector` interface (method-agnostic)
- `lib/drive/connector.ts` — stub implementation (throws "not configured")
- `lib/run/from-drive.ts` — `runCloseFromDrive(month, folderId, userId)` — lists +
  downloads files from a folder, then reuses the existing `runMonthlyClose` pipeline
- `components/drive-connect.tsx` — Settings card placeholder ("coming soon")

## Decision pending: which method (confirm with client)

| Method | Client effort | Build effort | Notes |
|---|---|---|---|
| **OAuth + Folder ID** | Connect once, paste folder ID | ~3h | Simplest, reliable. Recommended. |
| **OAuth + Google Picker** | Pick files each run | ~5h | Nicer UX, more code (Picker API + key) |
| **Service Account** | Share folder with SA email | ~3h | Fewest clicks; needs GCP service account |

## To wire up (OAuth + Folder ID path)

1. **Google Cloud Console** — create project, enable Drive API, create OAuth client.
   Scope: `https://www.googleapis.com/auth/drive.readonly`.
2. **Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
3. **Migration:** `drive_connection` table (mirror `qbo_connection`) — encrypted
   refresh token + configured `folder_id`.
4. **Routes:** `/api/drive/connect` + `/api/drive/callback` — mirror `lib/qbo/oauth.ts`.
5. **Implement `driveConnector`** in `lib/drive/connector.ts`:
   - `listFiles(folderId)` → `GET /drive/v3/files?q='<folderId>' in parents and trashed=false`
   - `downloadFile(fileId)` → `GET /drive/v3/files/{id}?alt=media`
6. **Settings UI:** replace the disabled `DriveConnect` button with a real
   connect flow + a folder-ID input.
7. **Dashboard:** add a "Run from Drive" option alongside the upload form, calling
   `runCloseFromDrive`.

The pipeline (parse → categorize → review → post) is unchanged — Drive only
replaces the file-acquisition step.
