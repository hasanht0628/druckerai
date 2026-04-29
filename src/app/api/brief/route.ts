import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { buildDailyBriefMessages } from "@/lib/prompts/daily-brief";
import { safeParseJson } from "@/lib/utils";
import type { ScoredEvent } from "@/types/calendar";
import type { DailyBrief } from "@/types/brief";

const todayStr = () => new Date().toISOString().split("T")[0];

async function generateBrief(): Promise<DailyBrief> {
  const [
    { data: cachedEvents },
    { data: tasks },
    { data: contextItems },
    { data: collaborators },
    { data: keyDocuments },
    { data: emailThreads },
  ] = await Promise.all([
    supabase.from("CalendarEventCache").select("*").gt("expiresAt", new Date().toISOString()).order("startTime", { ascending: true }),
    supabase.from("Task").select("*").neq("status", "done"),
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("Collaborator").select("*").order("importanceLevel", { ascending: false }),
    supabase.from("KeyDocument").select("*").eq("isActive", true).order("createdAt", { ascending: false }),
    supabase.from("EmailThreadCache").select("*").eq("isArchived", false).order("lastMessageAt", { ascending: false }).limit(8),
  ]);

  const events: ScoredEvent[] = (cachedEvents ?? []).map((c) => ({
    id: c.googleEventId,
    title: c.title,
    description: c.description,
    startTime: c.startTime,
    endTime: c.endTime,
    attendees: safeParseJson(c.attendeesJson, []),
    organizerEmail: c.organizerEmail,
    overall: c.overallScore ?? undefined,
    primaryConcern: (c.primaryConcern as ScoredEvent["primaryConcern"]) ?? undefined,
  }));

  const { systemPrompt, userMessage } = buildDailyBriefMessages(
    events,
    (tasks ?? []) as Parameters<typeof buildDailyBriefMessages>[1],
    (contextItems ?? []) as Parameters<typeof buildDailyBriefMessages>[2],
    (collaborators ?? []) as Parameters<typeof buildDailyBriefMessages>[3],
    (keyDocuments ?? []) as Parameters<typeof buildDailyBriefMessages>[4],
    (emailThreads ?? []) as Parameters<typeof buildDailyBriefMessages>[5]
  );

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const brief = safeParseJson<DailyBrief>(text, {} as DailyBrief);

  const midnight = new Date();
  midnight.setHours(23, 59, 59, 999);

  await supabase.from("DailyBriefCache").upsert(
    { date: todayStr(), briefJson: JSON.stringify(brief), expiresAt: midnight.toISOString() },
    { onConflict: "date" }
  );

  return brief;
}

export async function GET() {
  const { data: cached } = await supabase
    .from("DailyBriefCache")
    .select("*")
    .eq("date", todayStr())
    .single();

  if (cached && new Date(cached.expiresAt) > new Date()) {
    return NextResponse.json(safeParseJson<DailyBrief>(cached.briefJson, {} as DailyBrief));
  }

  return NextResponse.json(await generateBrief());
}

export async function POST() {
  await supabase.from("DailyBriefCache").delete().eq("date", todayStr());
  return NextResponse.json(await generateBrief());
}
