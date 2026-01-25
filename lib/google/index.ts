import { google } from "googleapis";
import { db } from "@/lib/database";
import { accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Refreshes a Google OAuth access token using the refresh token
 */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at?: number;
}> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      access_token: credentials.access_token!,
      expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : undefined,
    };
  } catch (error) {
    console.error("Error refreshing Google access token:", error);
    throw new Error("Failed to refresh Google access token");
  }
}

/**
 * Custom error class for Google OAuth reconnection requirements
 */
export class GoogleReconnectRequiredError extends Error {
  constructor(message: string = "Google account needs to be reconnected") {
    super(message);
    this.name = "GoogleReconnectRequiredError";
  }
}

/**
 * Gets a valid Google access token for a user, refreshing if necessary
 */
export async function getValidGoogleAccessToken(userId: string): Promise<{
  accessToken: string;
  isAccessToken: boolean;
}> {
  // Get the Google account from the database
  const [googleAccount] = await db
    .select({
      access_token: accounts.access_token,
      refresh_token: accounts.refresh_token,
      expires_at: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "google")
      )
    );

  if (!googleAccount) {
    throw new GoogleReconnectRequiredError("Google account not found");
  }

  // Check if access token is still valid (expires_at is Unix timestamp in seconds)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = googleAccount.expires_at ? now >= googleAccount.expires_at : false;

  if (googleAccount.access_token && !isExpired) {
    // Access token is still valid
    return {
      accessToken: googleAccount.access_token,
      isAccessToken: true,
    };
  }

  // Need to refresh the token
  if (!googleAccount.refresh_token) {
    throw new GoogleReconnectRequiredError(
      "No refresh token available. Please reconnect your Google account to continue."
    );
  }

  try {
    const { access_token, expires_at } = await refreshGoogleAccessToken(googleAccount.refresh_token);

    // Update the account with the new access token
    await db
      .update(accounts)
      .set({
        access_token: access_token,
        expires_at: expires_at,
      })
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.provider, "google")
        )
      );

    return {
      accessToken: access_token,
      isAccessToken: true,
    };
  } catch (error) {
    console.error("Error getting valid Google access token:", error);
    throw new GoogleReconnectRequiredError(
      "Failed to refresh Google access token. Please reconnect your Google account."
    );
  }
}

/**
 * Fetches a list of Google Docs from a user's Drive
 * Accepts either an access token or refresh token
 */
export async function listGoogleDocs(token: string, isAccessToken = false): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({ access_token: token });
  } else {
    oauth2Client.setCredentials({ refresh_token: token });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

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
 * Accepts either an access token or refresh token
 */
export async function getGoogleDoc(
  docId: string,
  token: string,
  isAccessToken = false
): Promise<{ id: string; name: string; content?: any }> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({ access_token: token });
  } else {
    oauth2Client.setCredentials({ refresh_token: token });
  }

  const docs = google.docs({ version: "v1", auth: oauth2Client });

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
 * Accepts either an access token or refresh token
 */
export async function getFolderId(
  folderName: string,
  token: string,
  isAccessToken = false
): Promise<string | null> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({ access_token: token });
  } else {
    oauth2Client.setCredentials({ refresh_token: token });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

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
 * Accepts either an access token or refresh token
 */
export async function listFilesInFolder(
  folderId: string,
  token: string,
  isAccessToken = false
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  if (isAccessToken) {
    // Use access token directly (short-lived, expires in ~1 hour)
    oauth2Client.setCredentials({
      access_token: token,
    });
  } else {
    // Use refresh token to get fresh access tokens
    oauth2Client.setCredentials({
      refresh_token: token,
    });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // Build query based on folderId
    // Special case: "root" means the user's root folder
    // For other folders, search for files with that folder as a parent
    let query: string;

    if (folderId === "root") {
      // For root, we need to find folders that are either:
      // 1. Directly in root, OR
      // 2. Shared with the user (have view permission)
      // We search for folders that the user can access
      query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    } else {
      // For specific folder, find files/folders directly in it
      // Also include shared items by checking if user has view access
      query = `'${folderId}' in parents and trashed = false`;
    }

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, webViewLink, owners)",
      pageSize: 100,
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
 * Lists all Google Docs folders accessible to the user
 * This includes folders in root, shared folders, and folders in subdirectories
 * Accepts either an access token or refresh token
 */
export async function listAllAccessibleFolders(
  token: string,
  isAccessToken = false
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({
      access_token: token,
    });
  } else {
    oauth2Client.setCredentials({
      refresh_token: token,
    });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // Search for all folders accessible to the user
    // This includes folders in root, shared folders, and folders in subdirectories
    const response = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name, mimeType, webViewLink, owners, permissions)",
      pageSize: 100,
    });

    return response.data.files?.map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
    })) || [];
  } catch (error) {
    console.error("Error listing accessible folders:", error);
    throw new Error("Failed to list accessible folders");
  }
}

/**
 * Lists all Google Docs accessible to the user (across entire Drive)
 * Useful as a fallback when folder-based listing doesn't show all files
 * Accepts either an access token or refresh token
 */
export async function listAllAccessibleDocs(
  token: string,
  isAccessToken = false
): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({
      access_token: token,
    });
  } else {
    oauth2Client.setCredentials({
      refresh_token: token,
    });
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // Search for all Google Docs accessible to the user
    const response = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.document' and trashed = false",
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
    });

    return response.data.files?.map((file) => ({
      id: file.id!,
      name: file.name!,
      modifiedTime: file.modifiedTime || undefined,
    })) || [];
  } catch (error) {
    console.error("Error listing accessible docs:", error);
    throw new Error("Failed to list accessible docs");
  }
}

/**
 * Lists all Google Docs accessible to the user using their user ID
 * Automatically handles token refresh if needed
 */
export async function listAllAccessibleDocsByUserId(
  userId: string
): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const { accessToken } = await getValidGoogleAccessToken(userId);
  return listAllAccessibleDocs(accessToken, true);
}

/**
 * Generates an OAuth2 URL for Google authentication
 * @param forceConsent - If true, forces the consent screen to appear (useful for reconnection)
 */
export function generateGoogleAuthUrl(forceConsent = false): string {
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
    // Always prompt for consent to ensure we get a refresh token
    // Google only returns refresh token on first authorization or when prompt=consent
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
