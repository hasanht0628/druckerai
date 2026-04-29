import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const ContextItemSchema = z.object({
  id: z.string().optional(),
  category: z.enum(["project", "goal", "deadline", "constraint", "priority", "preference"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("active") !== "false";

  let query = supabase
    .from("ContextItem")
    .select("*")
    .order("category", { ascending: true })
    .order("createdAt", { ascending: false });

  if (category) query = query.eq("category", category);
  if (activeOnly) query = query.eq("isActive", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = ContextItemSchema.parse(body);

  const { data: item, error } = await supabase
    .from("ContextItem")
    .insert({
      category: data.category,
      title: data.title,
      description: data.description ?? null,
      value: data.value ?? null,
      isActive: data.isActive ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const data = ContextItemSchema.parse(body);

  if (!data.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: item, error } = await supabase
    .from("ContextItem")
    .update({
      category: data.category,
      title: data.title,
      description: data.description ?? null,
      value: data.value ?? null,
      isActive: data.isActive,
    })
    .eq("id", data.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(item);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("ContextItem").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
