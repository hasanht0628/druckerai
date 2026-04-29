import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { fetchCalendarEvents, fetchUpcomingEvents } from "@/lib/google-calendar";
import { buildCalendarScoringMessages } from "@/lib/prompts/calendar-scoring";
import { safeParseJson } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const { eventIds, start, end } = await request.json() as {
    eventIds?: string[];
    start?: string;
    end?: string;
  };

  const [allEvents, { data: contextItems }, { data: collaborators }, { data: keyDocuments }, { data: emailThreads }] = await Promise.all([
    start && end
      ? fetchCalendarEvents({ startDate: start, endDate: end })
      : fetchUpcomingEvents(14),
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("Collaborator").select("*").order("importanceLevel", { ascending: false }),
    supabase.from("KeyDocument").select("*").eq("isActive", true).order("createdAt", { ascending: false }),
    supabase.from("EmailThreadCache").select("*").eq("isArchived", false).order("lastMessageAt", { ascending: false }).limit(8),
  ]);

  const eventsToScore = eventIds ? allEvents.filter((e) => eventIds.includes(e.id)) : allEvents;
  if (eventsToScore.length === 0) return NextResponse.json({ scored: 0 });

  const BATCH_SIZE = 15;
  const allResults: Record<string, unknown>[] = [];

  for (let i = 0; i < eventsToScore.length; i += BATCH_SIZE) {
    const batch = eventsToScore.slice(i, i + BATCH_SIZE);
    const { systemPrompt, userMessage } = buildCalendarScoringMessages(
      batch,
      (contextItems ?? []) as Parameters<typeof buildCalendarScoringMessages>[1],
      (collaborators ?? []) as Parameters<typeof buildCalendarScoringMessages>[2],
      (keyDocuments ?? []) as Parameters<typeof buildCalendarScoringMessages>[3],
      (emailThreads ?? []) as Parameters<typeof buildCalendarScoringMessages>[4]
    );

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    allResults.push(...safeParseJson<Record<string, unknown>[]>(text, []));
  }

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await Promise.all(
    allResults.map(async (result) => {
      const eventId = result.eventId as string;
      const event = eventsToScore.find((e) => e.id === eventId);
      if (!event) return;

      const scores = result.scores as Record<string, number> | undefined;
      const row = {
        googleEventId: eventId,
        title: event.title,
        description: event.description ?? null,
        startTime: event.startTime,
        endTime: event.endTime,
        attendeesJson: JSON.stringify(event.attendees),
        organizerEmail: event.organizerEmail ?? null,
        scoreImportance: scores?.importance ?? null,
        scoreUrgency: scores?.urgency ?? null,
        scoreContribution: scores?.contribution ?? null,
        scoreRelationship: scores?.relationship_value ?? null,
        scoreAlignment: scores?.project_alignment ?? null,
        overallScore: result.overall as number ?? null,
        scoringRationale: result.rationale as string ?? null,
        primaryConcern: result.primaryConcern as string ?? null,
        flagsJson: JSON.stringify(result.flags ?? []),
        cachedAt: new Date().toISOString(),
        expiresAt,
      };

      const { error } = await supabase
        .from("CalendarEventCache")
        .upsert(row, { onConflict: "googleEventId" });
      if (error) throw new Error(error.message);
    })
  );

  return NextResponse.json({ scored: allResults.length });
}
