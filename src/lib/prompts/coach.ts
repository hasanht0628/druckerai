import { safeParseJson } from "@/lib/utils";
import type { Collaborator } from "@/types/collaborator";
import type { ContextItem } from "@/types/context";
import type { KeyDocument } from "@/types/document";
import type { EmailThreadCache, EmailIntelligenceResult } from "@/types/email";
import type { Task } from "@/types/task";
import { buildContextBlock } from "./context-builder";

interface CalendarCacheRow {
  title: string;
  startTime: string;
  endTime: string;
  overallScore?: number | null;
  primaryConcern?: string | null;
  scoringRationale?: string | null;
}

interface EmailSignalRow {
  type: string;
  title: string;
  rationale?: string | null;
  dueDate?: string | null;
  confidence?: number | null;
}

interface DailyBriefRow {
  briefJson: string;
}

interface NoteExtractionRow {
  insightsJson: string;
  extractedAt: string;
}

interface CoachPromptInput {
  contextItems: ContextItem[];
  collaborators: Collaborator[];
  keyDocuments: KeyDocument[];
  emailThreads: EmailThreadCache[];
  emailSignals: EmailSignalRow[];
  tasks: Task[];
  calendarEvents: CalendarCacheRow[];
  dailyBrief?: DailyBriefRow | null;
  noteExtractions: NoteExtractionRow[];
}

export function buildCoachSystemPrompt(input: CoachPromptInput): string {
  const contextBlock = buildContextBlock(
    input.contextItems,
    input.collaborators,
    input.keyDocuments,
    input.emailThreads
  );

  return `You are DruckerAI's executive coach. You help the user think clearly about decisions, time, relationships, priorities, and contribution.

Voice:
- Be concise, direct, and specific.
- Prefer Drucker's test: "What can only I do that, if done well, will make a real difference?"
- Separate what you know from what you infer.
- Never invent facts. If context is missing, say what is missing and ask one useful question.
- When app data influences an answer, cite source categories inline: [task], [calendar], [email], [note], [document], [collaborator], [context], or [brief].
- End with one practical next step when appropriate.

${contextBlock}

RECENT OPERATING DATA:
${buildTaskSection(input.tasks)}

${buildCalendarSection(input.calendarEvents)}

${buildEmailSignalSection(input.emailSignals)}

${buildBriefSection(input.dailyBrief)}

${buildNoteInsightSection(input.noteExtractions)}

Today is ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}.`;
}

function buildTaskSection(tasks: Task[]): string {
  const openTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const pa = a.manualPriority ?? a.aiPriority ?? 999;
      const pb = b.manualPriority ?? b.aiPriority ?? 999;
      return pa - pb;
    })
    .slice(0, 10);

  if (openTasks.length === 0) return "Open tasks: (none)";

  return `Open tasks:
${openTasks
  .map((task) => {
    const priority = task.priorityLabel ? ` [${task.priorityLabel}]` : "";
    const due = task.dueDate ? ` due ${new Date(task.dueDate).toLocaleDateString()}` : "";
    const reason = task.priorityReason ? ` — ${task.priorityReason}` : "";
    return `- ${task.title}${priority}${due}${reason}`;
  })
  .join("\n")}`;
}

function buildCalendarSection(events: CalendarCacheRow[]): string {
  const upcoming = events.slice(0, 8);
  if (upcoming.length === 0) return "Calendar signals: (none scored)";

  return `Calendar signals:
${upcoming
  .map((event) => {
    const score = typeof event.overallScore === "number" ? ` score ${Math.round(event.overallScore)}` : "";
    const concern = event.primaryConcern ? ` ${event.primaryConcern}` : "";
    const rationale = event.scoringRationale ? ` — ${event.scoringRationale}` : "";
    return `- ${event.title} (${new Date(event.startTime).toLocaleString()})${score}${concern}${rationale}`;
  })
  .join("\n")}`;
}

function buildEmailSignalSection(signals: EmailSignalRow[]): string {
  const openSignals = signals.slice(0, 10);
  if (openSignals.length === 0) return "Open email signals: (none)";

  return `Open email signals:
${openSignals
  .map((signal) => {
    const due = signal.dueDate ? ` due ${new Date(signal.dueDate).toLocaleDateString()}` : "";
    const reason = signal.rationale ? ` — ${signal.rationale}` : "";
    return `- ${signal.type}: ${signal.title}${due}${reason}`;
  })
  .join("\n")}`;
}

function buildBriefSection(briefRow?: DailyBriefRow | null): string {
  if (!briefRow) return "Current daily brief: (none cached)";

  const brief = safeParseJson<{
    topPriorities?: Array<{ title: string; rationale?: string }>;
    decisionsAwaiting?: Array<{ description: string; context?: string }>;
  }>(briefRow.briefJson, {});

  const priorities = (brief.topPriorities ?? [])
    .slice(0, 3)
    .map((priority) => `- ${priority.title}${priority.rationale ? ` — ${priority.rationale}` : ""}`)
    .join("\n");
  const decisions = (brief.decisionsAwaiting ?? [])
    .slice(0, 3)
    .map((decision) => `- ${decision.description}${decision.context ? ` — ${decision.context}` : ""}`)
    .join("\n");

  return `Current daily brief:
Top priorities:
${priorities || "  (none)"}
Decisions awaiting:
${decisions || "  (none)"}`;
}

function buildNoteInsightSection(noteExtractions: NoteExtractionRow[]): string {
  const insights = noteExtractions
    .flatMap((extraction) => safeParseJson<string[]>(extraction.insightsJson, []))
    .slice(0, 8);

  if (insights.length === 0) return "Recent note insights: (none)";
  return `Recent note insights:
${insights.map((insight) => `- ${insight}`).join("\n")}`;
}

export function summarizeEmailThread(thread: EmailThreadCache): string {
  const intelligence = safeParseJson<EmailIntelligenceResult>(thread.signalsJson, {
    summary: thread.summary ?? "",
    ignoreReason: null,
    openLoops: [],
    suggestedTasks: [],
    decisions: [],
    deadlines: [],
    collaborators: [],
    projectRefs: [],
    signals: [],
  });
  return intelligence.summary || thread.summary || thread.snippet || "";
}
