import type { ContextItem } from "@/types/context";
import type { Collaborator } from "@/types/collaborator";
import type { KeyDocument } from "@/types/document";
import type { EmailIntelligenceResult, EmailThreadCache } from "@/types/email";
import { safeParseJson } from "@/lib/utils";

export function buildContextBlock(
  contextItems: ContextItem[],
  collaborators: Collaborator[],
  keyDocuments: KeyDocument[] = [],
  emailThreads: EmailThreadCache[] = []
): string {
  const byCategory = (cat: string) =>
    contextItems
      .filter((c) => c.category === cat && c.isActive)
      .map((c) => `- ${c.title}${c.description ? `: ${c.description}` : ""}${c.value ? ` [${c.value}]` : ""}`)
      .join("\n") || "  (none set)";

  const keyCollaborators = collaborators
    .filter((c) => c.importanceLevel >= 4)
    .sort((a, b) => b.importanceLevel - a.importanceLevel)
    .map((c) => `- ${c.name} (${c.role ?? c.relationshipType}, importance: ${c.importanceLevel}/5)`)
    .join("\n") || "  (none set)";

  const activeDocs = keyDocuments.filter((d) => d.isActive).slice(0, 5);
  const docsSection = activeDocs.length
    ? activeDocs.map((d) => `### ${d.title}\n${d.summary}`).join("\n\n")
    : "  (none uploaded)";

  const emailSection = buildEmailSection(emailThreads);

  return `
USER CONTEXT:
Active Projects:
${byCategory("project")}

Goals:
${byCategory("goal")}

Upcoming Deadlines:
${byCategory("deadline")}

Constraints:
${byCategory("constraint")}

Priorities:
${byCategory("priority")}

Preferences:
${byCategory("preference")}

HIGH-IMPORTANCE COLLABORATORS (importance 4-5/5):
${keyCollaborators}

KEY DOCUMENTS (strategic reference):
${docsSection}

RECENT EMAIL INTELLIGENCE:
${emailSection}
`.trim();
}

function buildEmailSection(emailThreads: EmailThreadCache[]): string {
  const activeThreads = emailThreads
    .filter((thread) => !thread.isArchived)
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )
    .slice(0, 8);

  if (activeThreads.length === 0) return "  (none synced)";

  return activeThreads
    .map((thread) => {
      const intelligence = safeParseJson<EmailIntelligenceResult>(
        thread.signalsJson,
        {
          summary: thread.summary ?? "",
          ignoreReason: null,
          openLoops: [],
          suggestedTasks: [],
          decisions: [],
          deadlines: [],
          collaborators: [],
          projectRefs: [],
          signals: [],
        }
      );
      const participants = safeParseJson<Array<{ name?: string; email: string }>>(
        thread.participantsJson,
        []
      )
        .slice(0, 6)
        .map((participant) =>
          participant.name
            ? `${participant.name} <${participant.email}>`
            : participant.email
        )
        .join(", ");
      const signals = intelligence.signals
        .slice(0, 5)
        .map((signal) => `  - ${signal.type}: ${signal.title}${signal.dueDate ? ` [due ${signal.dueDate}]` : ""}`)
        .join("\n");
      const openLoops = intelligence.openLoops
        .slice(0, 3)
        .map((loop) => `  - Open loop: ${loop}`)
        .join("\n");
      const collaborators = intelligence.collaborators
        .slice(0, 5)
        .map((collaborator) => {
          const identity = collaborator.email
            ? `${collaborator.name || collaborator.email} <${collaborator.email}>`
            : collaborator.name || "Unknown collaborator";
          return `  - Collaborator: ${identity} — ${collaborator.context}`;
        })
        .join("\n");

      return `### ${thread.subject}
Last message: ${new Date(thread.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
Participants: ${participants || "(unknown)"}
Summary: ${intelligence.summary || thread.summary || thread.snippet || "(no summary)"}
${[collaborators, signals, openLoops].filter(Boolean).join("\n") || "  (no actionable signals)"}`;
    })
    .join("\n\n");
}
