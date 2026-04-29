import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { buildCalendarActionsMessages } from "@/lib/prompts/calendar-actions";
import { safeParseJson } from "@/lib/utils";
import type { ScoredEvent, ProposedAction } from "@/types/calendar";

export async function POST(request: NextRequest) {
  const { eventIds } = await request.json() as { eventIds: string[] };

  const { data: cached } = await supabase
    .from("CalendarEventCache")
    .select("*")
    .in("googleEventId", eventIds);

  const results: Record<string, ProposedAction[]> = {};

  await Promise.all(
    (cached ?? []).map(async (cache) => {
      const event: ScoredEvent = {
        id: cache.googleEventId,
        title: cache.title,
        description: cache.description,
        startTime: cache.startTime,
        endTime: cache.endTime,
        attendees: safeParseJson(cache.attendeesJson, []),
        organizerEmail: cache.organizerEmail,
        overall: cache.overallScore ?? undefined,
        rationale: cache.scoringRationale ?? undefined,
        primaryConcern: (cache.primaryConcern as ScoredEvent["primaryConcern"]) ?? undefined,
      };

      const { systemPrompt, userMessage } = buildCalendarActionsMessages(event);

      const response = await openai.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "[]";
      const actions = safeParseJson<ProposedAction[]>(text, []);
      results[cache.googleEventId] = actions;

      await supabase
        .from("CalendarEventCache")
        .update({ proposedActionsJson: JSON.stringify(actions) })
        .eq("googleEventId", cache.googleEventId);
    })
  );

  return NextResponse.json(results);
}
