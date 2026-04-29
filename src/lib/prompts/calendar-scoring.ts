import type { CalendarEvent } from "@/types/calendar";
import type { ContextItem } from "@/types/context";
import type { Collaborator } from "@/types/collaborator";
import type { KeyDocument } from "@/types/document";
import type { EmailThreadCache } from "@/types/email";
import { buildContextBlock } from "./context-builder";

export function buildCalendarScoringMessages(
  events: CalendarEvent[],
  contextItems: ContextItem[],
  collaborators: Collaborator[],
  keyDocuments: KeyDocument[] = [],
  emailThreads: EmailThreadCache[] = []
) {
  const contextBlock = buildContextBlock(contextItems, collaborators, keyDocuments, emailThreads);

  const systemPrompt = `You are DruckerAI, an AI Chief of Staff applying Peter Drucker's principles from "The Effective Executive."

Your role: Score calendar events to protect the executive's time and focus on highest contribution.

Drucker's scoring criteria:
1. IMPORTANCE (0-10): Does this event contribute to stated goals and priorities?
2. URGENCY (0-10): Time sensitivity. High urgency ≠ high importance (Eisenhower matrix).
3. CONTRIBUTION (0-10): Will this create lasting value? Does it move key projects forward?
4. RELATIONSHIP VALUE (0-10): Is this with a high-importance collaborator? Does it strengthen a key relationship?
5. PROJECT ALIGNMENT (0-10): Does this align with active projects and deadlines?

If a high-importance collaborator (listed below) appears as an attendee, add 2 points to relationship_value.

Overall score formula: (importance × 25 + contribution × 25 + project_alignment × 20 + relationship_value × 20 + urgency × 10) / 10

${contextBlock}

Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  const eventsJson = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.startTime,
    end: e.endTime,
    attendees: e.attendees.map((a) => a.email),
    organizer: e.organizerEmail,
  }));

  const userMessage = `Score these ${events.length} calendar events. Return ONLY a valid JSON array with no markdown, no explanation:

[{
  "eventId": "string",
  "scores": {
    "importance": number,
    "urgency": number,
    "contribution": number,
    "relationship_value": number,
    "project_alignment": number
  },
  "overall": number,
  "rationale": "2-3 sentences referencing specific goals/projects",
  "primaryConcern": "keep" | "challenge" | "eliminate",
  "flags": ("no_agenda" | "could_be_async" | "conflicts_with_deadline" | "key_relationship")[],
  "taskSuggestions": [{ "title": string, "description": string, "dueDate": string | null }]
}]

Events:
${JSON.stringify(eventsJson, null, 2)}`;

  return { systemPrompt, userMessage };
}
