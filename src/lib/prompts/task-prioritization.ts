import type { Task } from "@/types/task";
import type { ContextItem } from "@/types/context";
import type { KeyDocument } from "@/types/document";
import type { EmailThreadCache } from "@/types/email";
import { buildContextBlock } from "./context-builder";

export function buildTaskPrioritizationMessages(
  tasks: Task[],
  contextItems: ContextItem[],
  keyDocuments: KeyDocument[] = [],
  emailThreads: EmailThreadCache[] = []
) {
  const contextBlock = buildContextBlock(contextItems, [], keyDocuments, emailThreads);

  const systemPrompt = `You are DruckerAI. Prioritize this task list using Peter Drucker's contribution principle: rank highest what creates the most lasting value toward stated goals and active projects.

Ask: "What can only I do that, if done well, will make a real difference?"

${contextBlock}

Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  const taskData = tasks
    .filter((t) => t.status !== "done")
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      linkedProjectId: t.linkedProjectId,
    }));

  const userMessage = `Prioritize these ${taskData.length} tasks. Return ONLY a valid JSON array sorted highest priority first, no markdown:

[{
  "id": string,
  "aiPriority": number (1 = top),
  "priorityLabel": "critical" | "high" | "medium" | "low",
  "priorityReason": string (one sentence referencing a specific goal/project)
}]

Tasks:
${JSON.stringify(taskData, null, 2)}`;

  return { systemPrompt, userMessage };
}
