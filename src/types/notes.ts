export interface MeetingNote {
  id: string;
  title?: string | null;
  rawContent: string;
  source: "manual" | "granola";
  granolaId?: string | null;
  meetingDate?: Date | null;
  googleEventId?: string | null;
  calendarEventTitle?: string | null;
  calendarEventStartTime?: Date | null;
  createdAt: Date;
  extractions: NoteExtraction[];
}

export interface Decision {
  text: string;
  madeBy?: string | null;
  impact: "high" | "medium" | "low";
}

export interface ActionItem {
  task: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority: "high" | "medium" | "low";
}

export interface FollowUp {
  collaboratorName: string;
  topic: string;
  suggestedDate?: string | null;
}

export interface CalendarUpdate {
  type: "add_prep" | "add_follow_up" | "schedule_new" | "reschedule";
  description: string;
  eventTitle?: string | null;
  suggestedTime?: string | null;
}

export interface ContextUpdate {
  category: "project" | "goal" | "deadline" | "constraint" | "priority";
  action: "add" | "update" | "complete";
  title: string;
  description?: string | null;
}

export interface TaskSuggestion {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: "high" | "medium" | "low";
}

export interface NoteExtraction {
  id: string;
  noteId: string;
  decisions: Decision[];
  openQuestions: string[];
  actionItems: ActionItem[];
  followUps: FollowUp[];
  insights: string[];
  calendarUpdates: CalendarUpdate[];
  contextUpdates: ContextUpdate[];
  taskSuggestions: TaskSuggestion[];
  approvedAt?: Date | null;
  appliedAt?: Date | null;
  extractedAt: Date;
}

export interface GranolaMeeting {
  id: string;
  title: string;
  date: string;
  notes?: string;
}
