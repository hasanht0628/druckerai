import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import type { ActionItem, ContextUpdate } from "@/types/notes";

export async function POST(request: NextRequest) {
  const { extractionId, approvedCategories } = await request.json() as {
    extractionId: string;
    approvedCategories: { tasks?: boolean; contextUpdates?: boolean };
  };

  const { data: extraction } = await supabase
    .from("NoteExtraction")
    .select("*")
    .eq("id", extractionId)
    .single();

  if (!extraction) return NextResponse.json({ error: "Extraction not found" }, { status: 404 });

  const applied: string[] = [];

  if (approvedCategories.tasks) {
    const actionItems = safeParseJson<ActionItem[]>(extraction.actionItemsJson, []);
    if (actionItems.length > 0) {
      const { error: taskError } = await supabase.from("Task").insert(
        actionItems.map((a) => ({
          title: a.task,
          description: a.assignee ? `Assignee: ${a.assignee}` : null,
          status: "open",
          dueDate: a.dueDate ?? null,
          priorityLabel: a.priority,
          source: "note_extraction",
        }))
      );
      if (taskError) return NextResponse.json({ error: `Failed to create tasks: ${taskError.message}` }, { status: 500 });
      applied.push(`${actionItems.length} tasks created`);
    }
  }

  if (approvedCategories.contextUpdates) {
    const contextUpdates = safeParseJson<ContextUpdate[]>(extraction.contextUpdatesJson, []);
    let appliedContextCount = 0;

    for (const update of contextUpdates) {
      if (update.action === "add") {
        const { error } = await supabase.from("ContextItem").insert({
          category: update.category,
          title: update.title,
          description: update.description ?? null,
          isActive: true,
        });
        if (error) return NextResponse.json({ error: `Failed to apply context: ${error.message}` }, { status: 500 });
        appliedContextCount += 1;
        continue;
      }

      const { data: existingItems, error: findError } = await supabase
        .from("ContextItem")
        .select("*")
        .eq("category", update.category)
        .eq("title", update.title)
        .limit(1);

      if (findError) return NextResponse.json({ error: `Failed to apply context: ${findError.message}` }, { status: 500 });
      const existing = existingItems?.[0];

      if (update.action === "update") {
        if (existing) {
          const { error } = await supabase
            .from("ContextItem")
            .update({
              description: update.description ?? existing.description ?? null,
              isActive: true,
            })
            .eq("id", existing.id);
          if (error) return NextResponse.json({ error: `Failed to apply context: ${error.message}` }, { status: 500 });
        } else {
          const { error } = await supabase.from("ContextItem").insert({
            category: update.category,
            title: update.title,
            description: update.description ?? null,
            isActive: true,
          });
          if (error) return NextResponse.json({ error: `Failed to apply context: ${error.message}` }, { status: 500 });
        }
        appliedContextCount += 1;
        continue;
      }

      if (update.action === "complete" && existing) {
        const { error } = await supabase
          .from("ContextItem")
          .update({ isActive: false })
          .eq("id", existing.id);
        if (error) return NextResponse.json({ error: `Failed to apply context: ${error.message}` }, { status: 500 });
        appliedContextCount += 1;
      }
    }

    if (appliedContextCount > 0) {
      applied.push(`${appliedContextCount} context updates applied`);
    }
  }

  const appliedAt = new Date().toISOString();
  await supabase
    .from("NoteExtraction")
    .update({ appliedAt, approvedAt: appliedAt })
    .eq("id", extractionId);

  return NextResponse.json({ applied, appliedAt });
}
