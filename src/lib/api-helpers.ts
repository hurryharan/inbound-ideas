import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function handleRoute<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await fn();
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(err.issues.map((i) => i.message).join("; "), 422);
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error(err);
    return jsonError(message, 500);
  }
}
