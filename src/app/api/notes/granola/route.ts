import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchRecentMeetings, fetchMeetingById, isGranolaConfigured } from "@/lib/granola";

export async function GET(request: NextRequest) {
  if (!isGranolaConfigured()) {
    return NextResponse.json(
      { error: "Granola not configured. Add GRANOLA_API_TOKEN to .env.local." },
      { status: 400 }
    );
  }

  const noteId = request.nextUrl.searchParams.get("noteId");

  try {
    if (noteId) {
      const meeting = await fetchMeetingById(noteId);
      return NextResponse.json(meeting);
    }
    const meetings = await fetchRecentMeetings(20);
    return NextResponse.json(meetings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Granola API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
