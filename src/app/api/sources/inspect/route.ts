import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { extractSpreadsheetId, inspectGoogleSheet } from "@/lib/sources/google-sheet";
import type { SourceConfig } from "@/lib/sources/types";

const inspectSourceSchema = z.object({
  spreadsheetUrl: z.string().min(1),
});

/** Reads a workbook's tabs and headers without creating a Source or importing rows. */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { spreadsheetUrl } = inspectSourceSchema.parse(await req.json());
    const config: SourceConfig = {
      spreadsheetId: extractSpreadsheetId(spreadsheetUrl),
      spreadsheetUrl,
      sheetName: "",
    };
    const inspection = await inspectGoogleSheet(userId, config);
    return NextResponse.json({
      sheetName: inspection.sheetName,
      sheetNames: inspection.sheetNames,
      columnMapping: inspection.resolvedMapping,
      sheetTabs: inspection.sheetTabs,
    });
  });
}
