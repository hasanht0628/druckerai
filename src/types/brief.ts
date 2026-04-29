export interface BriefPriority {
  rank: number;
  taskId?: string | null;
  title: string;
  rationale: string;
}

export interface BriefMeeting {
  eventId: string;
  title: string;
  startTime: string;
  reason: string;
  suggestion?: string;
}

export interface DecisionAwaiting {
  description: string;
  context: string;
  urgency: "high" | "medium";
}

export interface FocusBlock {
  startTime: string;
  endTime: string;
  suggestedTask: string;
  rationale: string;
}

export interface OverdueFollowUp {
  collaboratorId: string;
  collaboratorName: string;
  daysSinceContact: number;
  suggestedTopic: string;
}

export interface DailyBrief {
  date: string;
  topPriorities: BriefPriority[];
  meetingsToProtect: BriefMeeting[];
  meetingsToChallenge: BriefMeeting[];
  decisionsAwaiting: DecisionAwaiting[];
  focusBlocks: FocusBlock[];
  overdueFollowUps: OverdueFollowUp[];
}
