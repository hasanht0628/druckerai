import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  role: z.string().optional().nullable(),
  relationshipType: z.enum(["advisor", "teammate", "investor", "customer", "partner"]).optional(),
  importanceLevel: z.number().int().min(1).max(5).optional(),
  preferredCadence: z.enum(["weekly", "biweekly", "monthly", "quarterly"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  lastContactDate: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase.from("Collaborator").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = UpdateSchema.parse(body);

  const { data: updated, error } = await supabase
    .from("Collaborator")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabase.from("Collaborator").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
