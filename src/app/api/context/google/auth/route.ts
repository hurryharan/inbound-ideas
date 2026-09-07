import crypto from "crypto";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const url = getGoogleAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
