import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { disconnectGoogle, isGoogleConnected } from "@/lib/google/oauth";

export async function GET() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    return NextResponse.json({ connected: await isGoogleConnected(userId) });
  });
}

export async function DELETE() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    await disconnectGoogle(userId);
    return NextResponse.json({ ok: true });
  });
}
