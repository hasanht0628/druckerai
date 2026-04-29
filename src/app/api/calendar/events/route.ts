import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { fetchCalendarEvents, fetchUpcomingEvents } from "@/lib/google-calendar";
import { safeParseJson } from "@/lib/utils";
import type { ScoredEvent } from "@/types/calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const days = parseInt(searchParams.get("days") ?? "7");

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  const events =
    start && end
      ? await fetchCalendarEvents({ startDate: start, endDate: end })
      : await fetchUpcomingEvents(days);
  const now = new Date();
  const eventIds = events.map((event) => event.id);
  const { data: notes } = eventIds.length
    ? await supabase
        .from("CalendarEventNote")
        .select("*")
        .in("googleEventId", eventIds)
    : { data: [] };
  const notesByEventId = new Map(
    (notes ?? []).map((note) => [note.googleEventId as string, note])
  );

  const scored: ScoredEvent[] = await Promise.all(
    events.map(async (event) => {
      const { data: cached } = await supabase
        .from("CalendarEventCache")
        .select("*")
        .eq("googleEventId", event.id)
        .single();

      if (cached && new Date(cached.expiresAt) > now && cached.overallScore !== null) {
        return {
          ...event,
          scores: {
            importance: cached.scoreImportance ?? 0,
            urgency: cached.scoreUrgency ?? 0,
            contribution: cached.scoreContribution ?? 0,
            relationship_value: cached.scoreRelationship ?? 0,
            project_alignment: cached.scoreAlignment ?? 0,
          },
          overall: cached.overallScore ?? undefined,
          rationale: cached.scoringRationale ?? undefined,
          primaryConcern: (cached.primaryConcern as ScoredEvent["primaryConcern"]) ?? undefined,
          flags: safeParseJson(cached.flagsJson, []),
          proposedActions: safeParseJson(cached.proposedActionsJson, []),
          taskSuggestions: safeParseJson(cached.taskSuggestionsJson, []),
          userAction: (cached.userAction as ScoredEvent["userAction"]) ?? undefined,
          note: notesByEventId.get(event.id) ?? null,
        };
      }
      return {
        ...event,
        note: notesByEventId.get(event.id) ?? null,
      };
    })
  );

  return NextResponse.json(scored);
}
