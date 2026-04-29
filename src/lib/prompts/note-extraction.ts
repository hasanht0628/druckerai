import type { ContextItem } from "@/types/context";
import type { Collaborator } from "@/types/collaborator";
import type { KeyDocument } from "@/types/document";
import { buildContextBlock } from "./context-builder";

export function buildNoteExtractionMessages(
  rawContent: string,
  contextItems: ContextItem[],
  collaborators: Collaborator[],
  keyDocuments: KeyDocument[] = []
) {
  const contextBlock = buildContextBlock(contextItems, collaborators, keyDocuments);
  const collaboratorNames = collaborators
    .map((c) => `${c.name} (${c.role ?? c.relationshipType})`)
    .join(", ");

  const systemPrompt = `You are DruckerAI's meeting analyst. Extract structured intelligence from raw meeting notes.

Focus on what requires action or tracking, not just what was discussed.

${contextBlock}

All collaborators (for tagging follow-ups): ${collaboratorNames || "(none set)"}

Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  const userMessage = `Extract from these meeting notes. Return ONLY valid JSON matching this schema exactly, no markdown:

{
  "decisions": [{ "text": string, "madeBy": string | null, "impact": "high" | "medium" | "low" }],
  "openQuestions": [string],
  "actionItems": [{ "task": string, "assignee": string | null, "dueDate": string | null, "priority": "high" | "medium" | "low" }],
  "followUps": [{ "collaboratorName": string, "topic": string, "suggestedDate": string | null }],
  "strategicInsights": [string],
  "calendarUpdates": [{ "type": "add_prep" | "add_follow_up" | "schedule_new" | "reschedule", "description": string, "eventTitle": string | null, "suggestedTime": string | null }],
  "contextUpdates": [{ "category": "project" | "goal" | "deadline" | "constraint" | "priority", "action": "add" | "update" | "complete", "title": string, "description": string | null }]
}

Raw notes:
${rawContent}`;

  return { systemPrompt, userMessage };
}
