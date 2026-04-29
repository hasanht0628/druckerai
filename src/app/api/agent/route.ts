import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db";
import { openai, MODEL } from "@/lib/anthropic";
import { buildAgentMessages, parseAgentPlan } from "@/lib/prompts/agent";
import {
  executeAgentTool,
  getToolRiskLevel,
  isAgentToolName,
  parseToolPayload,
} from "@/lib/agent/tools";
import type {
  AgentAction,
  AgentMessage,
  AgentThread,
  AgentToolName,
} from "@/types/agent";

export const maxDuration = 60;

const PostSchema = z.object({
  threadId: z.string().optional().nullable(),
  message: z.string().min(1).max(8000),
});

export async function GET() {
  const thread = await getOrCreateLatestThread();
  const [messages, actions] = await Promise.all([
    getThreadMessages(thread.id),
    getThreadActions(thread.id),
  ]);

  return NextResponse.json({ thread, messages, actions });
}

export async function POST(request: NextRequest) {
  let thread: AgentThread | null = null;

  try {
    const body = PostSchema.parse(await request.json());
    thread = body.threadId
      ? await getThreadById(body.threadId)
      : await createThread(body.message);

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await supabase.from("AgentMessage").insert({
      threadId: thread.id,
      role: "user",
      content: body.message,
    });

    const [context, history] = await Promise.all([
      loadAgentContext(),
      getThreadMessages(thread.id, 12),
    ]);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 1600,
      response_format: { type: "json_object" },
      messages: buildAgentMessages(context, history),
    });

    const plan = parseAgentPlan(completion.choices[0]?.message?.content ?? "{}");
    const actionRecords: AgentAction[] = [];
    const recommendationOnly = isRecommendationOnlyRequest(body.message);

    for (const action of plan.actions) {
      try {
        if (!isAgentToolName(action.type)) continue;
        if (recommendationOnly && isCollaboratorCreationTool(action.type)) continue;
        const type = action.type;
        const riskLevel = getToolRiskLevel(type);
        const payload = parseToolPayload(type, action.payload);

        if (riskLevel === "low") {
          const record = await recordAction(thread.id, type, payload, riskLevel, "pending");
          try {
            const result = await executeAgentTool(type, payload);
            actionRecords.push(
              await updateAction(record.id, {
                status: "executed",
                resultJson: JSON.stringify(result),
                executedAt: new Date().toISOString(),
              })
            );
          } catch (error) {
            actionRecords.push(
              await updateAction(record.id, {
                status: "failed",
                error: getErrorMessage(error),
              })
            );
          }
        } else {
          actionRecords.push(
            await recordAction(thread.id, type, payload, riskLevel, "pending")
          );
        }
      } catch (error) {
        console.error("Agent action planning failed", error);
        actionRecords.push(
          await recordAction(thread.id, "create_context_item", {
            category: "preference",
            title: "Agent action failed",
            description: getErrorMessage(error),
          }, "low", "failed")
        );
      }
    }

    const assistantContent = buildAssistantMessage(
      recommendationOnly ? enforceRecommendationOnlyMessage(plan.message) : plan.message,
      actionRecords
    );
    await supabase.from("AgentMessage").insert({
      threadId: thread.id,
      role: "assistant",
      content: assistantContent,
    });
    await supabase
      .from("AgentThread")
      .update({ updatedAt: new Date().toISOString() })
      .eq("id", thread.id);

    const [messages, actions] = await Promise.all([
      getThreadMessages(thread.id),
      getThreadActions(thread.id),
    ]);

    return NextResponse.json({ thread, messages, actions });
  } catch (error) {
    console.error("Agent request failed", error);
    if (thread) {
      const content = `I could not complete that request: ${getErrorMessage(error)}`;
      await supabase.from("AgentMessage").insert({
        threadId: thread.id,
        role: "assistant",
        content,
      });
      const [messages, actions] = await Promise.all([
        getThreadMessages(thread.id),
        getThreadActions(thread.id),
      ]);
      return NextResponse.json({ thread, messages, actions });
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

async function getOrCreateLatestThread(): Promise<AgentThread> {
  const { data } = await supabase
    .from("AgentThread")
    .select("*")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) return data as AgentThread;
  return createThread();
}

async function getThreadById(threadId: string): Promise<AgentThread | null> {
  const { data } = await supabase
    .from("AgentThread")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();
  return (data as AgentThread | null) ?? null;
}

async function createThread(firstMessage?: string): Promise<AgentThread> {
  const title = firstMessage
    ? firstMessage.trim().replace(/\s+/g, " ").slice(0, 80)
    : "Agent thread";
  const { data, error } = await supabase
    .from("AgentThread")
    .insert({ title })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AgentThread;
}

async function getThreadMessages(threadId: string, limit = 100): Promise<AgentMessage[]> {
  const { data, error } = await supabase
    .from("AgentMessage")
    .select("*")
    .eq("threadId", threadId)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as AgentMessage[]).reverse();
}

async function getThreadActions(threadId: string): Promise<AgentAction[]> {
  const { data, error } = await supabase
    .from("AgentAction")
    .select("*")
    .eq("threadId", threadId)
    .order("createdAt", { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as AgentAction[];
}

async function recordAction(
  threadId: string,
  type: AgentToolName,
  payload: unknown,
  riskLevel: AgentAction["riskLevel"],
  status: AgentAction["status"]
): Promise<AgentAction> {
  const { data, error } = await supabase
    .from("AgentAction")
    .insert({
      threadId,
      type,
      payloadJson: JSON.stringify(payload),
      riskLevel,
      status,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentAction;
}

async function updateAction(
  id: string,
  updates: Partial<Pick<AgentAction, "status" | "resultJson" | "error" | "executedAt" | "approvedAt">>
): Promise<AgentAction> {
  const { data, error } = await supabase
    .from("AgentAction")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentAction;
}

async function loadAgentContext() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const [
    { data: contextItems },
    { data: collaborators },
    { data: keyDocuments },
    { data: emailThreads },
    { data: emailSignals },
    { data: tasks },
    { data: calendarEvents },
    { data: dailyBrief },
    { data: noteExtractions },
  ] = await Promise.all([
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("Collaborator").select("*").order("importanceLevel", { ascending: false }),
    supabase.from("KeyDocument").select("*").eq("isActive", true).order("createdAt", { ascending: false }).limit(5),
    supabase.from("EmailThreadCache").select("*").eq("isArchived", false).order("lastMessageAt", { ascending: false }).limit(20),
    supabase.from("EmailSignal").select("*").eq("state", "open").order("createdAt", { ascending: false }).limit(10),
    supabase.from("Task").select("*").neq("status", "done").order("manualPriority", { ascending: true, nullsFirst: false }).order("aiPriority", { ascending: true, nullsFirst: false }).limit(12),
    supabase.from("CalendarEventCache").select("*").gt("endTime", now).order("startTime", { ascending: true }).limit(10),
    supabase.from("DailyBriefCache").select("briefJson").eq("date", today).maybeSingle(),
    supabase.from("NoteExtraction").select("insightsJson, extractedAt").order("extractedAt", { ascending: false }).limit(5),
  ]);

  return {
    contextItems: contextItems ?? [],
    collaborators: collaborators ?? [],
    keyDocuments: keyDocuments ?? [],
    emailThreads: emailThreads ?? [],
    emailSignals: emailSignals ?? [],
    tasks: tasks ?? [],
    calendarEvents: calendarEvents ?? [],
    dailyBrief: dailyBrief ?? null,
    noteExtractions: noteExtractions ?? [],
  };
}

function buildAssistantMessage(message: string, actions: AgentAction[]) {
  const executed = actions.filter((action) => action.status === "executed").length;
  const pending = actions.filter((action) => action.status === "pending").length;
  const failed = actions.filter((action) => action.status === "failed").length;
  const suffix = [
    executed ? `${executed} action${executed === 1 ? "" : "s"} completed` : null,
    pending ? `${pending} action${pending === 1 ? "" : "s"} need approval` : null,
    failed ? `${failed} action${failed === 1 ? "" : "s"} failed` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return suffix ? `${message}\n\n${suffix}.` : message;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function isCollaboratorCreationTool(type: AgentToolName) {
  return type === "create_collaborator" || type === "create_collaborators_from_email";
}

function isRecommendationOnlyRequest(message: string) {
  const normalized = message.toLowerCase();
  const asksForRecommendation =
    /\b(what|who|which)\b/.test(normalized) &&
    /\b(should|recommend|think)\b/.test(normalized) &&
    /\b(add|create|import)\b/.test(normalized);
  const explicitlyCommandsWrite =
    /\b(go ahead|please add|add them|create them|import them|do it)\b/.test(normalized);

  return asksForRecommendation && !explicitlyCommandsWrite;
}

function enforceRecommendationOnlyMessage(message: string) {
  const suffix = "I have not added them yet. Tell me which ones to queue for approval.";
  if (/not added them yet|queue.*approval/i.test(message)) return message;
  return `${message.replace(/\b(actions? completed|created|added|imported)\b/gi, "recommendations identified").trim()}\n\n${suffix}`;
}
