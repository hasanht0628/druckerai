import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { listRecentDocs, fetchDriveDocText, isDriveConfigured } from "@/lib/google-drive";
import { generateDocumentSummary } from "@/lib/prompts/document-summary";

export const maxDuration = 30;

export async function GET() {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive not configured. Re-run scripts/setup-google-auth.js to add Drive scope." },
      { status: 400 }
    );
  }

  try {
    const docs = await listRecentDocs(20);
    return NextResponse.json(docs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list Drive docs";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive not configured." },
      { status: 400 }
    );
  }

  const { fileId, fileName } = await request.json() as { fileId: string; fileName: string };
  if (!fileId || !fileName) {
    return NextResponse.json({ error: "fileId and fileName are required" }, { status: 400 });
  }

  try {
    const rawText = await fetchDriveDocText(fileId);
    const summary = await generateDocumentSummary(fileName, rawText);

    const { data, error } = await supabase
      .from("KeyDocument")
      .insert({
        title: fileName,
        source: "google_drive",
        mimeType: "application/vnd.google-apps.document",
        driveFileId: fileId,
        driveFileName: fileName,
        summary,
        rawText: rawText.slice(0, 50_000),
        isActive: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import from Drive";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
