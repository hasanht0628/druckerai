import type { ScoredEvent } from "@/types/calendar";

export function buildCalendarActionsMessages(event: ScoredEvent) {
  const systemPrompt = `You are DruckerAI. Generate specific proposed actions for a calendar event based on its scores.

Available action types:
- keep: No change needed
- delete: Remove the event entirely
- move: Reschedule to a better time
- shorten: Reduce duration
- add_prep_time: Add a prep block before the event
- add_follow_up: Add a follow-up block after the event
- ask_for_agenda: Request an agenda from the organizer
- ask_to_reschedule: Ask organizer to move it
- convert_to_async: Cancel and convert to email/doc update

Rules:
- Only propose "delete" if overall score < 30
- Always include "keep" if overall score > 70
- Propose 1-3 actions maximum
- Be specific (e.g., "Shorten to 30 min — a status update doesn't need 60 min")`;

  const userMessage = `Event: "${event.title}"
Start: ${event.startTime}
End: ${event.endTime}
Attendees: ${event.attendees.map((a) => a.email).join(", ")}
Overall score: ${event.overall ?? "unscored"}
Primary concern: ${event.primaryConcern ?? "unknown"}
Rationale: ${event.rationale ?? ""}

Propose 1-3 specific actions. Return ONLY valid JSON array, no markdown:

[{
  "type": string,
  "description": string,
  "confidence": number (0-1),
  "parameters": {
    "newStartTime"?: string (ISO),
    "newEndTime"?: string (ISO),
    "prepMinutes"?: number,
    "followUpMinutes"?: number,
    "message"?: string
  }
}]`;

  return { systemPrompt, userMessage };
}
