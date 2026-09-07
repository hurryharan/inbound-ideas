import { NextResponse } from "next/server";
import { DEFAULT_IDEATION_PROMPT } from "@/lib/ideas/prompt";

export async function GET() {
  return NextResponse.json({ defaultPrompt: DEFAULT_IDEATION_PROMPT });
}
