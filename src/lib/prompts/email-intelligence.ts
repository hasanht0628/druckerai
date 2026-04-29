import { openai, MODEL } from "@/lib/anthropic";
import { safeParseJson } from "@/lib/utils";
import type { ContextItem } from "@/types/context";
import type { Collaborator } from "@/types/collaborator";
import type {
  EmailIntelligenceResult,
  NormalizedEmailThread,
} from "@/types/email";
import { buildContextBlock } from "./context-builder";

const EMPTY_RESULT: EmailIntelligenceResult = {
  summary: "",
  ignoreReason: null,
  openLoops: [],
  suggestedTasks: [],
  decisions: [],
  deadlines: [],
  collaborators: [],
  projectRefs: [],
  signals: [],
};

export async function extractEmailIntelligence(
  thread: NormalizedEmailThread,
  contextItems: ContextItem[],
  collaborators: Collaborator[]
): Promise<EmailIntelligenceResult> {
  const contextBlock = buildContextBlock(contextItems, collaborators);
  const collaboratorHint = collaborators
    .map((c) => `${c.name}${c.email ? ` <${c.email}>` : ""} (${c.role ?? c.relationshipType})`)
    .join(", ");

  const threadText = thread.messages
    .map((message) => {
      const from = message.from
        ? `${message.from.name ? `${message.from.name} ` : ""}<${message.from.email}>`
        : "unknown sender";
      const date = message.date ?? "unknown date";
      return `From: ${from}\nDate: ${date}\nSnippet: ${message.snippet ?? ""}\n\n${message.bodyText}`;
    })
    .join("\n\n--- message ---\n\n")
    .slice(0, 50_000);

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1400,
    messages: [
      {
        role: "system",
        content: `You are DruckerAI's email intelligence analyst. Convert email threads into concise planning signals for an executive chief-of-staff system.

Focus only on information that should affect planning, priorities, decisions, relationship follow-up, deadlines, or context. Treat Gmail's Important marker as a first-pass filter, but still reject threads that are merely automated updates.

Ignore newsletters, receipts, promotions, product/account updates, automated notifications, FYI-only messages, and low-signal threads. If ignored, still return valid JSON with ignoreReason populated and all arrays empty.

${contextBlock}

Known collaborators: ${collaboratorHint || "(none set)"}

Return only valid JSON. No markdown.`,
      },
      {
        role: "user",
        content: `Analyze this Gmail thread and return exactly this JSON shape:

{
  "summary": "1-3 dense sentences, factual, no filler",
  "ignoreReason": string | null,
  "openLoops": [string],
  "suggestedTasks": [{ "title": string, "description": string | null, "dueDate": string | null, "priority": "high" | "medium" | "low" }],
  "decisions": [string],
  "deadlines": [{ "title": string, "date": string, "rationale": string | null }],
  "collaborators": [{ "name": string | null, "email": string | null, "context": string }],
  "projectRefs": [string],
  "signals": [{
    "type": "task" | "decision" | "follow_up" | "deadline" | "context" | "fyi",
    "title": string,
    "rationale": string | null,
    "dueDate": string | null,
    "collaboratorEmail": string | null,
    "confidence": number | null
  }]
}

Thread subject: ${thread.subject}
Participants: ${JSON.stringify(thread.participants)}
Labels: ${JSON.stringify(thread.labels)}
Last message: ${thread.lastMessageAt}

Thread messages:
${threadText}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = safeParseJson<EmailIntelligenceResult>(text, EMPTY_RESULT);

  return {
    ...EMPTY_RESULT,
    ...parsed,
    openLoops: parsed.openLoops ?? [],
    suggestedTasks: parsed.suggestedTasks ?? [],
    decisions: parsed.decisions ?? [],
    deadlines: parsed.deadlines ?? [],
    collaborators: parsed.collaborators ?? [],
    projectRefs: parsed.projectRefs ?? [],
    signals: parsed.signals ?? [],
  };
}
