import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/lib/db";
import { generateDocumentSummary } from "@/lib/prompts/document-summary";

export const maxDuration = 30;

async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();

  const texts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const stripped = xml
      .replace(/<a:t[^>]*>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped) texts.push(stripped);
  }
  return texts.join("\n\n");
}

async function extractText(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (mimeType === "application/pdf" || ext === "pdf") {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === "xlsx" || ext === "xls"
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      return `## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    return extractTextFromPptx(buffer);
  }

  return new TextDecoder().decode(buffer);
}

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "xlsx", "xls", "pptx", "txt", "md"];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const titleOverride = formData.get("title") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 4 MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let rawText = "";
  try {
    rawText = await extractText(buffer, file.name, file.type);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to extract text: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 422 }
    );
  }

  if (rawText.trim().length < 20) {
    return NextResponse.json({ error: "Could not extract readable text from file" }, { status: 422 });
  }

  const title = titleOverride?.trim() || file.name.replace(/\.[^.]+$/, "");
  const summary = await generateDocumentSummary(title, rawText);

  const { data, error } = await supabase
    .from("KeyDocument")
    .insert({
      title,
      source: "upload",
      mimeType: file.type || `application/${ext}`,
      summary,
      rawText: rawText.slice(0, 50_000),
      isActive: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
