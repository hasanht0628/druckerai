export interface EmailParticipant {
  name?: string;
  email: string;
}

export interface NormalizedEmailMessage {
  id: string;
  from?: EmailParticipant;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  date?: string;
  snippet?: string;
  bodyText: string;
}

export interface NormalizedEmailThread {
  threadId: string;
  subject: string;
  participants: EmailParticipant[];
  labels: string[];
  lastMessageAt: string;
  snippet?: string;
  messages: NormalizedEmailMessage[];
}

export type EmailSignalType =
  | "task"
  | "decision"
  | "follow_up"
  | "deadline"
  | "context"
  | "fyi";

export interface EmailSignal {
  type: EmailSignalType;
  title: string;
  rationale?: string | null;
  dueDate?: string | null;
  collaboratorEmail?: string | null;
  confidence?: number | null;
}

export interface EmailIntelligenceResult {
  summary: string;
  ignoreReason?: string | null;
  openLoops: string[];
  suggestedTasks: Array<{
    title: string;
    description?: string | null;
    dueDate?: string | null;
    priority?: "high" | "medium" | "low";
  }>;
  decisions: string[];
  deadlines: Array<{
    title: string;
    date: string;
    rationale?: string | null;
  }>;
  collaborators: Array<{
    name?: string | null;
    email?: string | null;
    context: string;
  }>;
  projectRefs: string[];
  signals: EmailSignal[];
}

export interface EmailThreadCache {
  id: string;
  gmailThreadId: string;
  subject: string;
  participantsJson: string;
  lastMessageAt: string;
  snippet?: string | null;
  summary?: string | null;
  signalsJson: string;
  labelsJson: string;
  isArchived: boolean;
  syncedAt: string;
}
