import { google } from "googleapis";

/**
 * Fetches a list of Google Docs from a user's Drive
 */
export async function listGoogleDocs(accessToken: string): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const drive = google.drive({ version: "v3", auth: accessToken });

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document'",
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
    });

    return response.data.files?.map((file) => ({
      id: file.id!,
      name: file.name!,
      modifiedTime: file.modifiedTime || undefined,
    })) || [];
  } catch (error) {
    console.error("Error listing Google Docs:", error);
    throw new Error("Failed to list Google Docs");
  }
}

/**
 * Fetches a specific Google Doc by ID
 */
export async function getGoogleDoc(
  docId: string,
  accessToken: string
): Promise<{ id: string; name: string; content?: any }> {
  const docs = google.docs({ version: "v1", auth: accessToken });

  try {
    const response = await docs.documents.get({
      documentId: docId,
    });

    return {
      id: response.data.documentId || docId,
      name: response.data.title || "Untitled",
      content: response.data,
    };
  } catch (error) {
    console.error("Error fetching Google Doc:", error);
    throw new Error("Failed to fetch Google Doc");
  }
}

/**
 * Gets the user's Google Drive folder ID for a specific folder name
 */
export async function getFolderId(
  folderName: string,
  accessToken: string
): Promise<string | null> {
  const drive = google.drive({ version: "v3", auth: accessToken });

  try {
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
      fields: "files(id, name)",
    });

    const folder = response.data.files?.[0];
    return folder?.id || null;
  } catch (error) {
    console.error("Error finding folder:", error);
    return null;
  }
}

/**
 * Lists files in a specific Google Drive folder
 */
export async function listFilesInFolder(
  folderId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const drive = google.drive({ version: "v3", auth: accessToken });

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
    });

    return response.data.files?.map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
    })) || [];
  } catch (error) {
    console.error("Error listing files in folder:", error);
    throw new Error("Failed to list files in folder");
  }
}

/**
 * Generates an OAuth2 URL for Google authentication
 */
export function generateGoogleAuthUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
      "openid",
      "email",
      "profile",
    ],
    prompt: "consent",
  });
}

/**
 * Exchanges authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token) {
      throw new Error("No access token received");
    }
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      id_token: tokens.id_token || undefined,
    };
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    throw new Error("Failed to exchange code for tokens");
  }
}
