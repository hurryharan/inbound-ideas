import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

// Google OAuth (PRD section 11/32): read-only Drive + Sheets scopes, tokens
// encrypted at rest. Refresh token is stored per-user in UserPreference
// under the "google_oauth" key so this stays a single row to manage.

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

const GOOGLE_OAUTH_PREFERENCE_KEY = "google_oauth";

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function storeGoogleTokensForUser(userId: string, code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke prior access at https://myaccount.google.com/permissions and reconnect."
    );
  }

  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: GOOGLE_OAUTH_PREFERENCE_KEY } },
    update: { value: { refreshTokenEncrypted: encryptSecret(tokens.refresh_token), connectedAt: new Date().toISOString() } },
    create: {
      userId,
      key: GOOGLE_OAUTH_PREFERENCE_KEY,
      value: { refreshTokenEncrypted: encryptSecret(tokens.refresh_token), connectedAt: new Date().toISOString() },
    },
  });
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: GOOGLE_OAUTH_PREFERENCE_KEY } },
  });
  return Boolean(pref);
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.userPreference.deleteMany({ where: { userId, key: GOOGLE_OAUTH_PREFERENCE_KEY } });
}

/** Returns an OAuth2Client authorized with the user's stored refresh token, ready to pass to a googleapis client. */
export async function getGoogleAuthClient(userId: string) {
  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: GOOGLE_OAUTH_PREFERENCE_KEY } },
  });
  if (!pref) {
    throw new Error("Google is not connected. Connect it from Context settings.");
  }

  const value = pref.value as { refreshTokenEncrypted: string };
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: decryptSecret(value.refreshTokenEncrypted) });
  return client;
}
