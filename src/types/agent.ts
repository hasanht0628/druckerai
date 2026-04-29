export type AgentMessageRole = "user" | "assistant";

export type AgentActionStatus = "pending" | "executed" | "rejected" | "failed";

export type AgentRiskLevel = "low" | "approval_required";

export type AgentToolName =
  | "create_task"
  | "create_tasks_from_email_signal"
  | "create_collaborator"
  | "create_collaborators_from_email"
  | "create_context_item"
  | "create_calendar_event"
  | "dismiss_email_signal"
  | "accept_email_signal"
  | "update_task"
  | "complete_task"
  | "schedule_focus_block"
  | "prepare_for_meeting"
  | "create_follow_up_task"
  | "update_collaborator"
  | "remember_preference"
  | "plan_my_day"
  | "triage_email_signals"
  | "weekly_review"
  | "relationship_checkup"
  | "decision_log_entry";

export interface AgentThread {
  id: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  threadId: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
}

export interface AgentAction {
  id: string;
  threadId: string;
  type: AgentToolName;
  payloadJson: string;
  status: AgentActionStatus;
  riskLevel: AgentRiskLevel;
  resultJson?: string | null;
  error?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  executedAt?: string | null;
}

export interface AgentActionPlan {
  type: AgentToolName;
  reason?: string;
  payload: unknown;
}

export interface AgentPlannerResult {
  message: string;
  actions: AgentActionPlan[];
}

export interface AgentResponse {
  thread: AgentThread | null;
  messages: AgentMessage[];
  actions: AgentAction[];
}
