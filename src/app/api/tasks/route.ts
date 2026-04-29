import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  dueDate: z.string().optional().nullable(),
  linkedProjectId: z.string().optional().nullable(),
  source: z.enum(["manual", "note_extraction", "calendar", "brief", "email"]).optional(),
});

export async function GET() {
  const { data, error } = await supabase
    .from("Task")
    .select("*")
    .order("status", { ascending: true })
    .order("manualPriority", { ascending: true, nullsFirst: false })
    .order("aiPriority", { ascending: true, nullsFirst: false })
    .order("createdAt", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = TaskSchema.parse(body);

  const { data: task, error } = await supabase
    .from("Task")
    .insert({
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "open",
      dueDate: data.dueDate ?? null,
      linkedProjectId: data.linkedProjectId ?? null,
      source: data.source ?? "manual",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(task, { status: 201 });
}
