export type CoachMessageRole = "user" | "assistant";

export interface CoachThread {
  id: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachMessage {
  id: string;
  threadId: string;
  role: CoachMessageRole;
  content: string;
  createdAt: string;
}

export interface CoachThreadResponse {
  thread: CoachThread | null;
  messages: CoachMessage[];
}
