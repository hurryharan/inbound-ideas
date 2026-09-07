import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { storeGoogleTokensForUser } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  const redirectTo = new URL("/context", url.origin);

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectTo.searchParams.set("google_error", "Invalid or expired OAuth state. Please try again.");
    return NextResponse.redirect(redirectTo);
  }

  try {
    const userId = await getCurrentUserId();
    await storeGoogleTokensForUser(userId, code);
    redirectTo.searchParams.set("google_connected", "1");
  } catch (err) {
    redirectTo.searchParams.set("google_error", err instanceof Error ? err.message : "Failed to connect Google.");
  }

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
