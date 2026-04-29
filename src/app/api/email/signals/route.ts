import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const PatchSchema = z.object({
  id: z.string().min(1),
  state: z.enum(["open", "accepted", "dismissed"]),
});

export async function GET() {
  const { data, error } = await supabase
    .from("EmailSignal")
    .select(`
      *,
      EmailThreadCache (
        subject,
        "gmailThreadId",
        summary,
        "lastMessageAt"
      )
    `)
    .eq("state", "open")
    .order("createdAt", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const body = PatchSchema.parse(await request.json());

  const { data, error } = await supabase
    .from("EmailSignal")
    .update({ state: body.state })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
