import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const CollaboratorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  role: z.string().optional().nullable(),
  relationshipType: z.enum(["advisor", "teammate", "investor", "customer", "partner"]),
  importanceLevel: z.number().int().min(1).max(5).default(3),
  preferredCadence: z.enum(["weekly", "biweekly", "monthly", "quarterly"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  lastContactDate: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
});

export async function GET() {
  const { data, error } = await supabase
    .from("Collaborator")
    .select("*")
    .order("importanceLevel", { ascending: false })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = CollaboratorSchema.parse(body);

  const { data: collaborator, error } = await supabase
    .from("Collaborator")
    .insert({
      name: data.name,
      email: data.email ?? null,
      role: data.role ?? null,
      relationshipType: data.relationshipType,
      importanceLevel: data.importanceLevel,
      preferredCadence: data.preferredCadence ?? null,
      notes: data.notes ?? null,
      lastContactDate: data.lastContactDate ?? null,
      nextFollowUpDate: data.nextFollowUpDate ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(collaborator, { status: 201 });
}
