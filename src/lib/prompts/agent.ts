import { safeParseJson } from "@/lib/utils";
import { AGENT_TOOL_GUIDE } from "@/lib/agent/tools";
import type { AgentMessage, AgentPlannerResult } from "@/types/agent";
import { buildCoachSystemPrompt } from "./coach";

type AgentContextInput = Parameters<typeof buildCoachSystemPrompt>[0];

const EMPTY_PLAN: AgentPlannerResult = {
  message: "I could not determine a safe action. Tell me what you want changed.",
  actions: [],
};

export function buildAgentMessages(
  context: AgentContextInput,
  history: AgentMessage[]
) {
  const appContext = buildCoachSystemPrompt(context);

  const systemPrompt = `You are Drucker's app-wide operating agent. You can help the user act across the app using typed tools.

Your job:
- Understand the user's request.
- Use the app context to avoid asking for information you already have.
- Choose tools only when the user wants a concrete app change.
- Use no tools when the user is asking for advice, explanation, or analysis.
- Use no tools when the user asks what/who/which items they should add. In that case, list recommendations in "message" and ask whether to queue them for approval.
- Never claim an action happened unless it is returned as an action for the server to execute.
- Calendar writes and collaborator creation require approval. Do not present them as completed.

${AGENT_TOOL_GUIDE}

Return ONLY valid JSON in this shape:
{
  "message": "short user-facing response",
  "actions": [
    {
      "type": "one of the available tool names",
      "reason": "why this action is appropriate",
      "payload": {}
    }
  ]
}

${appContext}`;

  return [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

export function parseAgentPlan(text: string): AgentPlannerResult {
  const parsed = safeParseJson<AgentPlannerResult>(text, EMPTY_PLAN);
  return {
    message: parsed.message || EMPTY_PLAN.message,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}
