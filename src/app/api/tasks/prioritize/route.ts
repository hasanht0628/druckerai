import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { buildTaskPrioritizationMessages } from "@/lib/prompts/task-prioritization";
import { safeParseJson } from "@/lib/utils";
import type { AIPriorityResult } from "@/types/task";

export async function POST() {
  const [{ data: tasks }, { data: contextItems }, { data: keyDocuments }, { data: emailThreads }] = await Promise.all([
    supabase.from("Task").select("*").neq("status", "done"),
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("KeyDocument").select("*").eq("isActive", true).order("createdAt", { ascending: false }),
    supabase.from("EmailThreadCache").select("*").eq("isArchived", false).order("lastMessageAt", { ascending: false }).limit(8),
  ]);

  if (!tasks || tasks.length === 0) return NextResponse.json({ updated: 0 });

  const { systemPrompt, userMessage } = buildTaskPrioritizationMessages(
    tasks as Parameters<typeof buildTaskPrioritizationMessages>[0],
    (contextItems ?? []) as Parameters<typeof buildTaskPrioritizationMessages>[1],
    (keyDocuments ?? []) as Parameters<typeof buildTaskPrioritizationMessages>[2],
    (emailThreads ?? []) as Parameters<typeof buildTaskPrioritizationMessages>[3]
  );

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const results = safeParseJson<AIPriorityResult[]>(text, []);
  if (results.length === 0) return NextResponse.json({ error: "AI returned no results" }, { status: 500 });

  await Promise.all(
    results.map((r) =>
      supabase
        .from("Task")
        .update({ aiPriority: r.aiPriority, priorityLabel: r.priorityLabel, priorityReason: r.priorityReason })
        .eq("id", r.id)
    )
  );

  return NextResponse.json({ updated: results.length });
}
