export type TaskStatus = "open" | "in_progress" | "done";
export type PriorityLabel = "critical" | "high" | "medium" | "low";
export type TaskSource = "manual" | "note_extraction" | "calendar" | "brief" | "email";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  aiPriority?: number | null;
  manualPriority?: number | null;
  priorityLabel?: PriorityLabel | null;
  priorityReason?: string | null;
  dueDate?: Date | null;
  linkedProjectId?: string | null;
  source: TaskSource;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface AIPriorityResult {
  id: string;
  aiPriority: number;
  priorityLabel: PriorityLabel;
  priorityReason: string;
}
