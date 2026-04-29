import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db";

const NoteSchema = z.object({
  googleEventId: z.string().min(1),
  prepNotes: z.string().optional().nullable(),
  logisticsNotes: z.string().optional().nullable(),
  outcomeNotes: z.string().optional().nullable(),
  followUps: z.string().optional().nullable(),
  usefulness: z.enum(["useful", "mixed", "not_useful"]).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const googleEventId = request.nextUrl.searchParams.get("eventId");
  if (!googleEventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("CalendarEventNote")
    .select("*")
    .eq("googleEventId", googleEventId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function PUT(request: NextRequest) {
  const data = NoteSchema.parse(await request.json());

  const { data: note, error } = await supabase
    .from("CalendarEventNote")
    .upsert(
      {
        googleEventId: data.googleEventId,
        prepNotes: data.prepNotes ?? null,
        logisticsNotes: data.logisticsNotes ?? null,
        outcomeNotes: data.outcomeNotes ?? null,
        followUps: data.followUps ?? null,
        usefulness: data.usefulness ?? null,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "googleEventId" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(note);
}
