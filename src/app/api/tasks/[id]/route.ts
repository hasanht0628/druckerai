import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  manualPriority: z.number().int().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  linkedProjectId: z.string().optional().nullable(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = UpdateSchema.parse(body);

  const updates: Record<string, unknown> = { ...data };

  if (data.status === "done") updates.completedAt = new Date().toISOString();
  else if (data.status === "open" || data.status === "in_progress") updates.completedAt = null;

  const { data: task, error } = await supabase
    .from("Task")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabase.from("Task").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
