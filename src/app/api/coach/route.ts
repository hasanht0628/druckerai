import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { buildCoachSystemPrompt } from "@/lib/prompts/coach";
import type { CoachMessage, CoachThread } from "@/types/coach";

export const maxDuration = 60;

const PostSchema = z.object({
  threadId: z.string().optional().nullable(),
  message: z.string().min(1).max(8000),
});

export async function GET() {
  const thread = await getOrCreateLatestThread();
  const messages = await getThreadMessages(thread.id);

  return NextResponse.json({ thread, messages });
}

export async function POST(request: NextRequest) {
  const body = PostSchema.parse(await request.json());
  const thread = body.threadId
    ? await getThreadById(body.threadId)
    : await createThread(body.message);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  await supabase.from("CoachMessage").insert({
    threadId: thread.id,
    role: "user",
    content: body.message,
  });

  await supabase
    .from("CoachThread")
    .update({ updatedAt: new Date().toISOString() })
    .eq("id", thread.id);

  const [context, history] = await Promise.all([
    loadCoachContext(),
    getThreadMessages(thread.id, 18),
  ]);
  const systemPrompt = buildCoachSystemPrompt(context);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let assistantText = "";

      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          stream: true,
          max_tokens: 1200,
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (!delta) continue;
          assistantText += delta;
          controller.enqueue(encoder.encode(delta));
        }

        if (assistantText.trim()) {
          await supabase.from("CoachMessage").insert({
            threadId: thread.id,
            role: "assistant",
            content: assistantText.trim(),
          });
          await supabase
            .from("CoachThread")
            .update({ updatedAt: new Date().toISOString() })
            .eq("id", thread.id);
        }

        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            "\n\nI couldn't complete that response. Try again in a moment."
          )
        );
        controller.close();
        console.error("Coach stream failed", error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Coach-Thread-Id": thread.id,
    },
  });
}

async function getOrCreateLatestThread(): Promise<CoachThread> {
  const { data } = await supabase
    .from("CoachThread")
    .select("*")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) return data as CoachThread;
  return createThread();
}

async function getThreadById(threadId: string): Promise<CoachThread | null> {
  const { data } = await supabase
    .from("CoachThread")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();

  return (data as CoachThread | null) ?? null;
}

async function createThread(firstMessage?: string): Promise<CoachThread> {
  const title = firstMessage
    ? firstMessage.trim().replace(/\s+/g, " ").slice(0, 80)
    : "New coach thread";
  const { data, error } = await supabase
    .from("CoachThread")
    .insert({ title })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CoachThread;
}

async function getThreadMessages(
  threadId: string,
  limit = 100
): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from("CoachMessage")
    .select("*")
    .eq("threadId", threadId)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as CoachMessage[]).reverse();
}

async function loadCoachContext() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const [
    { data: contextItems },
    { data: collaborators },
    { data: keyDocuments },
    { data: emailThreads },
    { data: emailSignals },
    { data: tasks },
    { data: calendarEvents },
    { data: dailyBrief },
    { data: noteExtractions },
  ] = await Promise.all([
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("Collaborator").select("*").order("importanceLevel", { ascending: false }),
    supabase.from("KeyDocument").select("*").eq("isActive", true).order("createdAt", { ascending: false }).limit(5),
    supabase.from("EmailThreadCache").select("*").eq("isArchived", false).order("lastMessageAt", { ascending: false }).limit(8),
    supabase.from("EmailSignal").select("*").eq("state", "open").order("createdAt", { ascending: false }).limit(10),
    supabase.from("Task").select("*").neq("status", "done").order("manualPriority", { ascending: true, nullsFirst: false }).order("aiPriority", { ascending: true, nullsFirst: false }).limit(12),
    supabase.from("CalendarEventCache").select("*").gt("endTime", now).order("startTime", { ascending: true }).limit(10),
    supabase.from("DailyBriefCache").select("briefJson").eq("date", today).maybeSingle(),
    supabase.from("NoteExtraction").select("insightsJson, extractedAt").order("extractedAt", { ascending: false }).limit(5),
  ]);

  return {
    contextItems: contextItems ?? [],
    collaborators: collaborators ?? [],
    keyDocuments: keyDocuments ?? [],
    emailThreads: emailThreads ?? [],
    emailSignals: emailSignals ?? [],
    tasks: tasks ?? [],
    calendarEvents: calendarEvents ?? [],
    dailyBrief: dailyBrief ?? null,
    noteExtractions: noteExtractions ?? [],
  };
}
