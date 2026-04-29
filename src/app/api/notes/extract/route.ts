import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { buildNoteExtractionMessages } from "@/lib/prompts/note-extraction";
import { safeParseJson } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const { noteId } = await request.json() as { noteId: string };

  const [{ data: note }, { data: contextItems }, { data: collaborators }, { data: keyDocuments }] = await Promise.all([
    supabase.from("MeetingNote").select("*").eq("id", noteId).single(),
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("Collaborator").select("*").order("importanceLevel", { ascending: false }),
    supabase.from("KeyDocument").select("*").eq("isActive", true).order("createdAt", { ascending: false }),
  ]);

  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const { systemPrompt, userMessage } = buildNoteExtractionMessages(
    note.rawContent,
    (contextItems ?? []) as Parameters<typeof buildNoteExtractionMessages>[1],
    (collaborators ?? []) as Parameters<typeof buildNoteExtractionMessages>[2],
    (keyDocuments ?? []) as Parameters<typeof buildNoteExtractionMessages>[3]
  );

  const stream = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          controller.enqueue(new TextEncoder().encode(delta));
        }
      }

      try {
        const parsed = safeParseJson<Record<string, unknown> | null>(fullText, null);
        if (!parsed) throw new Error("Extraction response was not valid JSON");

        const { error } = await supabase.from("NoteExtraction").insert({
          noteId,
          decisionsJson: JSON.stringify(parsed.decisions ?? []),
          openQuestionsJson: JSON.stringify(parsed.openQuestions ?? []),
          actionItemsJson: JSON.stringify(parsed.actionItems ?? []),
          followUpsJson: JSON.stringify(parsed.followUps ?? []),
          insightsJson: JSON.stringify(parsed.strategicInsights ?? []),
          calendarUpdatesJson: JSON.stringify(parsed.calendarUpdates ?? []),
          contextUpdatesJson: JSON.stringify(parsed.contextUpdates ?? []),
        });
        if (error) throw new Error(error.message);
      } catch (error) {
        console.warn(
          "Failed to persist note extraction",
          error instanceof Error ? error.message : error
        );
        // Non-fatal parse error
      }

      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
