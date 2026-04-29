import type { ScoredEvent } from "@/types/calendar";
import type { Task } from "@/types/task";
import type { ContextItem } from "@/types/context";
import type { Collaborator } from "@/types/collaborator";
import type { KeyDocument } from "@/types/document";
import type { EmailThreadCache } from "@/types/email";
import { buildContextBlock } from "./context-builder";
import { differenceInDays } from "date-fns";

export function buildDailyBriefMessages(
  events: ScoredEvent[],
  tasks: Task[],
  contextItems: ContextItem[],
  collaborators: Collaborator[],
  keyDocuments: KeyDocument[] = [],
  emailThreads: EmailThreadCache[] = []
) {
  const contextBlock = buildContextBlock(contextItems, collaborators, keyDocuments, emailThreads);
  const today = new Date();

  const overdueCollaborators = collaborators
    .filter(
      (c) =>
        c.nextFollowUpDate && new Date(c.nextFollowUpDate) < today
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      daysSinceContact: c.lastContactDate
        ? differenceInDays(today, new Date(c.lastContactDate))
        : null,
      nextFollowUpDate: c.nextFollowUpDate,
    }));

  const topTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const pa = a.manualPriority ?? a.aiPriority ?? 999;
      const pb = b.manualPriority ?? b.aiPriority ?? 999;
      return pa - pb;
    })
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priorityLabel: t.priorityLabel,
      dueDate: t.dueDate,
    }));

  const todayEvents = events
    .filter((e) => {
      const d = new Date(e.startTime);
      return d.toDateString() === today.toDateString();
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      overall: e.overall,
      primaryConcern: e.primaryConcern,
    }));

  const systemPrompt = `You are DruckerAI. Generate the Daily Effectiveness Brief for your executive.

Apply Drucker's test: "What can only I do that, if done well, will make a real difference?"

${contextBlock}

Today is ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  const userMessage = `Generate today's effectiveness brief. Return ONLY valid JSON, no markdown:

{
  "date": "${today.toISOString().split("T")[0]}",
  "topPriorities": [
    { "rank": 1, "taskId": string | null, "title": string, "rationale": string }
  ],
  "meetingsToProtect": [{ "eventId": string, "title": string, "startTime": string, "reason": string }],
  "meetingsToChallenge": [{ "eventId": string, "title": string, "startTime": string, "reason": string, "suggestion": string }],
  "decisionsAwaiting": [{ "description": string, "context": string, "urgency": "high" | "medium" }],
  "focusBlocks": [{ "startTime": string, "endTime": string, "suggestedTask": string, "rationale": string }],
  "overdueFollowUps": [{ "collaboratorId": string, "collaboratorName": string, "daysSinceContact": number, "suggestedTopic": string }]
}

topPriorities must have exactly 3 items. Decide holistically from all available data — goals, deadlines, calendar, collaborator urgency, and tasks. If a priority maps to an existing task use its exact id for taskId; if it is a new insight not yet in the task list set taskId to null.
focusBlocks should identify calendar gaps of 30+ minutes for deep work. Use ISO 8601 datetime strings for startTime and endTime.

Data:
- Top tasks: ${JSON.stringify(topTasks)}
- Today's events: ${JSON.stringify(todayEvents)}
- Overdue collaborator follow-ups: ${JSON.stringify(overdueCollaborators)}`;

  return { systemPrompt, userMessage };
}
