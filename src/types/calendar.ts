export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  attendees: CalendarAttendee[];
  organizerEmail?: string | null;
  htmlLink?: string;
  location?: string | null;
}

export interface CalendarEventNote {
  id: string;
  googleEventId: string;
  prepNotes?: string | null;
  logisticsNotes?: string | null;
  outcomeNotes?: string | null;
  followUps?: string | null;
  usefulness?: "useful" | "mixed" | "not_useful" | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventScores {
  importance: number;
  urgency: number;
  contribution: number;
  relationship_value: number;
  project_alignment: number;
}

export type EventFlag =
  | "no_agenda"
  | "could_be_async"
  | "conflicts_with_deadline"
  | "key_relationship";

export type PrimaryConcern = "keep" | "challenge" | "eliminate";

export interface ScoredEvent extends CalendarEvent {
  scores?: EventScores;
  overall?: number;
  rationale?: string;
  primaryConcern?: PrimaryConcern;
  flags?: EventFlag[];
  proposedActions?: ProposedAction[];
  taskSuggestions?: TaskSuggestion[];
  userAction?: "approved" | "rejected" | "pending";
  note?: CalendarEventNote | null;
}

export type CalendarActionType =
  | "keep"
  | "delete"
  | "move"
  | "shorten"
  | "add_prep_time"
  | "add_follow_up"
  | "ask_for_agenda"
  | "ask_to_reschedule"
  | "convert_to_async";

export interface ProposedAction {
  type: CalendarActionType;
  description: string;
  confidence: number;
  parameters?: {
    newStartTime?: string;
    newEndTime?: string;
    prepMinutes?: number;
    followUpMinutes?: number;
    message?: string;
  };
}

export interface TaskSuggestion {
  title: string;
  description?: string;
  dueDate?: string;
}
