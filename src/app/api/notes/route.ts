import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { z } from "zod";

const NoteSchema = z.object({
  title: z.string().optional().nullable(),
  rawContent: z.string().min(1),
  source: z.enum(["manual", "granola"]).optional(),
  granolaId: z.string().optional().nullable(),
  meetingDate: z.string().optional().nullable(),
  googleEventId: z.string().optional().nullable(),
  calendarEventTitle: z.string().optional().nullable(),
  calendarEventStartTime: z.string().optional().nullable(),
});

const LinkNoteSchema = z.object({
  id: z.string().min(1),
  googleEventId: z.string().optional().nullable(),
  calendarEventTitle: z.string().optional().nullable(),
  calendarEventStartTime: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const googleEventId = searchParams.get("googleEventId");

  let query = supabase
    .from("MeetingNote")
    .select("*")
    .order("createdAt", { ascending: false });

  if (googleEventId) {
    query = query.eq("googleEventId", googleEventId);
  }

  const { data: notes, error } = await query.range(
    (page - 1) * limit,
    page * limit - 1
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch latest extraction per note
  const notesWithExtractions = await Promise.all(
    (notes ?? []).map(async (note) => {
      const { data: extractions } = await supabase
        .from("NoteExtraction")
        .select("*")
        .eq("noteId", note.id)
        .order("extractedAt", { ascending: false })
        .limit(1);
      return { ...note, extractions: extractions ?? [] };
    })
  );

  return NextResponse.json(notesWithExtractions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = NoteSchema.parse(body);

  const { data: note, error } = await supabase
    .from("MeetingNote")
    .insert({
      title: data.title ?? null,
      rawContent: data.rawContent,
      source: data.source ?? "manual",
      granolaId: data.granolaId ?? null,
      meetingDate: data.meetingDate ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data.googleEventId) {
    return NextResponse.json(note, { status: 201 });
  }

  const { data: linkedNote, error: linkError } = await supabase
    .from("MeetingNote")
    .update({
      googleEventId: data.googleEventId,
      calendarEventTitle: data.calendarEventTitle ?? null,
      calendarEventStartTime: data.calendarEventStartTime ?? null,
    })
    .eq("id", note.id)
    .select()
    .single();

  if (linkError) {
    console.warn("Meeting note saved without calendar link", linkError.message);
    return NextResponse.json(
      {
        ...note,
        linkWarning:
          "Note was saved, but the calendar link could not be stored. Run the latest Supabase migration for MeetingNote link columns.",
      },
      { status: 201 }
    );
  }

  return NextResponse.json(linkedNote, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const data = LinkNoteSchema.parse(body);

  const { data: note, error } = await supabase
    .from("MeetingNote")
    .update({
      googleEventId: data.googleEventId ?? null,
      calendarEventTitle: data.calendarEventTitle ?? null,
      calendarEventStartTime: data.calendarEventStartTime ?? null,
    })
    .eq("id", data.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(note);
}
