import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { generateDocumentSummary } from "@/lib/prompts/document-summary";

export async function GET() {
  const { data, error } = await supabase
    .from("KeyDocument")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { title, rawText } = await request.json() as { title: string; rawText: string };

  if (!title?.trim() || !rawText?.trim()) {
    return NextResponse.json({ error: "title and rawText are required" }, { status: 400 });
  }

  const summary = await generateDocumentSummary(title, rawText);

  const { data, error } = await supabase
    .from("KeyDocument")
    .insert({
      title: title.trim(),
      source: "paste",
      summary,
      rawText: rawText.slice(0, 50_000),
      isActive: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { id, title, isActive } = await request.json() as {
    id: string;
    title?: string;
    isActive?: boolean;
  };

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (isActive !== undefined) updates.isActive = isActive;

  const { data, error } = await supabase
    .from("KeyDocument")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("KeyDocument").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
