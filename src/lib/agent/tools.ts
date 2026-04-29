import { z } from "zod";
import { supabase } from "@/lib/db";
import { createCalendarEvent } from "@/lib/google-calendar";
import { safeParseJson } from "@/lib/utils";
import type { AgentRiskLevel, AgentToolName } from "@/types/agent";
import type { EmailIntelligenceResult } from "@/types/email";

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priorityLabel: z.enum(["critical", "high", "medium", "low"]).optional().nullable(),
});

const EmailSignalSelectionSchema = z.object({
  signalId: z.string().optional(),
  signalIds: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

const CreateCollaboratorSchema = z.object({
  name: z.string().min(1),
  email: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().email().optional().nullable()
  ),
  role: z.string().optional().nullable(),
  relationshipType: z.preprocess(
    normalizeRelationshipType,
    z.enum(["advisor", "teammate", "investor", "customer", "partner"]).default("partner")
  ),
  importanceLevel: z.coerce.number().int().min(1).max(5).default(3),
  notes: z.string().optional().nullable(),
});

const CreateCollaboratorsFromEmailSchema = z.object({
  threadIds: z.array(z.string()).optional(),
  signalIds: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  relationshipType: z.preprocess(
    normalizeRelationshipType,
    z.enum(["advisor", "teammate", "investor", "customer", "partner"]).default("partner")
  ),
  importanceLevel: z.coerce.number().int().min(1).max(5).default(3),
});

const CreateContextItemSchema = z.object({
  category: z.enum(["project", "goal", "deadline", "constraint", "priority", "preference"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
});

const CreateCalendarEventSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  description: z.string().optional().nullable(),
});

const UpdateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  manualPriority: z.coerce.number().int().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  linkedProjectId: z.string().optional().nullable(),
});

const CompleteTaskSchema = z.object({
  id: z.string().min(1),
});

const ScheduleFocusBlockSchema = z.object({
  title: z.string().min(1).default("Focus block"),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  description: z.string().optional().nullable(),
});

const PrepareForMeetingSchema = z.object({
  eventId: z.string().optional(),
  title: z.string().optional(),
});

const CreateFollowUpTaskSchema = z.object({
  collaboratorId: z.string().optional(),
  collaboratorName: z.string().optional(),
  title: z.string().min(1),
  topic: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

const UpdateCollaboratorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().email().optional().nullable()
  ),
  role: z.string().optional().nullable(),
  relationshipType: z
    .preprocess(
      normalizeRelationshipType,
      z.enum(["advisor", "teammate", "investor", "customer", "partner"]).optional()
    ),
  importanceLevel: z.coerce.number().int().min(1).max(5).optional(),
  preferredCadence: z.enum(["weekly", "biweekly", "monthly", "quarterly"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  lastContactDate: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
});

const RememberPreferenceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
});

const EmptyObjectSchema = z.object({}).passthrough();

const DecisionLogEntrySchema = z.object({
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().optional().nullable(),
  expectedOutcome: z.string().optional().nullable(),
  confidence: z.coerce.number().min(0).max(1).optional().nullable(),
  reviewDate: z.string().optional().nullable(),
  source: z.record(z.unknown()).optional(),
});

const schemas = {
  create_task: CreateTaskSchema,
  create_tasks_from_email_signal: EmailSignalSelectionSchema,
  create_collaborator: CreateCollaboratorSchema,
  create_collaborators_from_email: CreateCollaboratorsFromEmailSchema,
  create_context_item: CreateContextItemSchema,
  create_calendar_event: CreateCalendarEventSchema,
  dismiss_email_signal: EmailSignalSelectionSchema,
  accept_email_signal: EmailSignalSelectionSchema,
  update_task: UpdateTaskSchema,
  complete_task: CompleteTaskSchema,
  schedule_focus_block: ScheduleFocusBlockSchema,
  prepare_for_meeting: PrepareForMeetingSchema,
  create_follow_up_task: CreateFollowUpTaskSchema,
  update_collaborator: UpdateCollaboratorSchema,
  remember_preference: RememberPreferenceSchema,
  plan_my_day: EmptyObjectSchema,
  triage_email_signals: EmptyObjectSchema,
  weekly_review: EmptyObjectSchema,
  relationship_checkup: EmptyObjectSchema,
  decision_log_entry: DecisionLogEntrySchema,
} satisfies Record<AgentToolName, z.ZodTypeAny>;

const riskLevels = {
  create_task: "low",
  create_tasks_from_email_signal: "approval_required",
  create_collaborator: "approval_required",
  create_collaborators_from_email: "approval_required",
  create_context_item: "low",
  create_calendar_event: "approval_required",
  dismiss_email_signal: "low",
  accept_email_signal: "low",
  update_task: "low",
  complete_task: "low",
  schedule_focus_block: "approval_required",
  prepare_for_meeting: "low",
  create_follow_up_task: "low",
  update_collaborator: "low",
  remember_preference: "low",
  plan_my_day: "low",
  triage_email_signals: "low",
  weekly_review: "low",
  relationship_checkup: "low",
  decision_log_entry: "low",
} satisfies Record<AgentToolName, AgentRiskLevel>;

const toolNames = Object.keys(riskLevels) as AgentToolName[];

export const AGENT_TOOL_GUIDE = `
Available tools:
- create_task: low risk, execute directly. Payload: { title, description?, dueDate? }
- create_tasks_from_email_signal: approval required for bulk. Payload: { signalId?, signalIds?, limit? }
- create_collaborator: approval required. Payload: { name, email?, role?, relationshipType?, importanceLevel?, notes? }
- create_collaborators_from_email: approval required for bulk. Payload: { threadIds?, signalIds?, limit?, relationshipType?, importanceLevel? }
- create_context_item: low risk, execute directly. Payload: { category, title, description?, value? }
- create_calendar_event: approval required. Payload: { title, startTime, endTime, description? }
- dismiss_email_signal / accept_email_signal: low risk. Payload: { signalId?, signalIds?, limit? }
- update_task: low risk for one task. Payload: { id, title?, description?, status?, manualPriority?, dueDate? }
- complete_task: low risk. Payload: { id }
- schedule_focus_block: approval required. Payload: { title, startTime, endTime, description? }
- prepare_for_meeting: low risk read-only prep. Payload: { eventId? or title? }
- create_follow_up_task: low risk. Payload: { collaboratorId? or collaboratorName?, title, topic?, dueDate? }
- update_collaborator: low risk for one collaborator. Payload: { id, name?, email?, role?, relationshipType?, importanceLevel?, preferredCadence?, notes?, lastContactDate?, nextFollowUpDate? }
- remember_preference: low risk. Payload: { title, description?, value? }
- plan_my_day / triage_email_signals / weekly_review / relationship_checkup: low risk read-only workflow summaries. Payload: {}
- decision_log_entry: low risk. Payload: { title, decision, rationale?, expectedOutcome?, confidence?, reviewDate?, source? }

Policy:
- Directly execute create_task and create_context_item when the user clearly asks.
- Collaborator creation always requires approval.
- Recommendation questions such as "who should I add?", "what collaborators should I add?", or "based on email, who should be added?" are read-only. Do not call create_collaborator or create_collaborators_from_email. List the recommended people in the message and ask whether the user wants them queued for approval.
- When the user explicitly asks to add/import/create collaborators from email, use create_collaborators_from_email rather than individual create_collaborator calls.
- Use bulk email tools when the user asks for many items from Gmail/email. These require approval.
- Queue create_collaborator, create_calendar_event, schedule_focus_block, create_tasks_from_email_signal, and create_collaborators_from_email for approval, even if the user asks clearly.
- Do not delete records, send email, modify existing calendar events, or perform bulk destructive actions.
`.trim();

export function getToolRiskLevel(type: AgentToolName): AgentRiskLevel {
  return riskLevels[type];
}

export function isAgentToolName(type: unknown): type is AgentToolName {
  return typeof type === "string" && toolNames.includes(type as AgentToolName);
}

export function parseToolPayload(type: AgentToolName, payload: unknown) {
  return schemas[type].parse(payload);
}

export async function executeAgentTool(type: AgentToolName, payload: unknown) {
  switch (type) {
    case "create_task": {
      const data = CreateTaskSchema.parse(payload);
      const { data: task, error } = await supabase
        .from("Task")
        .insert({
          title: data.title,
          description: data.description ?? null,
          dueDate: data.dueDate ?? null,
          priorityLabel: data.priorityLabel ?? null,
          status: "open",
          source: "manual",
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "task", record: task };
    }

    case "create_tasks_from_email_signal": {
      const data = EmailSignalSelectionSchema.parse(payload);
      const signals = await selectEmailSignals(data);
      const taskSignals = signals.filter((signal) =>
        ["task", "follow_up", "deadline"].includes(String(signal.type))
      );
      if (taskSignals.length === 0) return { kind: "email_tasks", created: [] };

      const { data: tasks, error } = await supabase
        .from("Task")
        .insert(
          taskSignals.map((signal) => ({
            title: signal.title,
            description: signal.rationale ?? null,
            dueDate: signal.dueDate ?? null,
            source: "email",
            status: "open",
          }))
        )
        .select();
      if (error) throw new Error(error.message);
      await updateEmailSignalState(taskSignals.map((signal) => signal.id), "accepted");
      return { kind: "email_tasks", created: tasks ?? [], acceptedSignalIds: taskSignals.map((signal) => signal.id) };
    }

    case "create_collaborator": {
      const data = CreateCollaboratorSchema.parse(payload);
      const existing = data.email ? await findCollaboratorByEmail(data.email) : null;
      if (existing) return { kind: "collaborator", record: existing, skipped: "already_exists" };
      const { data: collaborator, error } = await supabase
        .from("Collaborator")
        .insert({
          name: data.name,
          email: data.email ?? null,
          role: data.role ?? null,
          relationshipType: data.relationshipType,
          importanceLevel: data.importanceLevel,
          notes: data.notes ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "collaborator", record: collaborator };
    }

    case "create_collaborators_from_email": {
      const data = CreateCollaboratorsFromEmailSchema.parse(payload);
      const candidates = await collectEmailCollaboratorCandidates(data);
      const created = [];
      const skipped = [];

      for (const candidate of candidates) {
        if (!candidate.email && !candidate.name) continue;
        const existing = candidate.email ? await findCollaboratorByEmail(candidate.email) : null;
        if (existing) {
          skipped.push({ candidate, reason: "already_exists", collaborator: existing });
          continue;
        }
        const { data: collaborator, error } = await supabase
          .from("Collaborator")
          .insert({
            name: candidate.name || candidate.email,
            email: candidate.email ?? null,
            role: candidate.role ?? null,
            relationshipType: data.relationshipType,
            importanceLevel: data.importanceLevel,
            notes: candidate.context ?? null,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        created.push(collaborator);
      }

      return { kind: "email_collaborators", created, skipped };
    }

    case "create_context_item": {
      const data = CreateContextItemSchema.parse(payload);
      const { data: contextItem, error } = await supabase
        .from("ContextItem")
        .insert({
          category: data.category,
          title: data.title,
          description: data.description ?? null,
          value: data.value ?? null,
          isActive: true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "context_item", record: contextItem };
    }

    case "create_calendar_event": {
      const data = CreateCalendarEventSchema.parse(payload);
      const eventId = await createCalendarEvent(
        data.title,
        data.startTime,
        data.endTime,
        data.description ?? undefined
      );
      return { kind: "calendar_event", eventId };
    }

    case "dismiss_email_signal": {
      const data = EmailSignalSelectionSchema.parse(payload);
      const signals = await selectEmailSignals(data);
      await updateEmailSignalState(signals.map((signal) => signal.id), "dismissed");
      return { kind: "email_signals", state: "dismissed", ids: signals.map((signal) => signal.id) };
    }

    case "accept_email_signal": {
      const data = EmailSignalSelectionSchema.parse(payload);
      const signals = await selectEmailSignals(data);
      await updateEmailSignalState(signals.map((signal) => signal.id), "accepted");
      return { kind: "email_signals", state: "accepted", ids: signals.map((signal) => signal.id) };
    }

    case "update_task": {
      const data = UpdateTaskSchema.parse(payload);
      const { id, ...updates } = data;
      const finalUpdates: Record<string, unknown> = { ...updates };
      if (data.status === "done") finalUpdates.completedAt = new Date().toISOString();
      if (data.status === "open" || data.status === "in_progress") finalUpdates.completedAt = null;
      const { data: task, error } = await supabase
        .from("Task")
        .update(finalUpdates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "task", record: task };
    }

    case "complete_task": {
      const data = CompleteTaskSchema.parse(payload);
      const { data: task, error } = await supabase
        .from("Task")
        .update({ status: "done", completedAt: new Date().toISOString() })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "task", record: task };
    }

    case "schedule_focus_block": {
      const data = ScheduleFocusBlockSchema.parse(payload);
      const eventId = await createCalendarEvent(
        data.title,
        data.startTime,
        data.endTime,
        data.description ?? "[DruckerAI] Focus block"
      );
      return { kind: "focus_block", eventId };
    }

    case "prepare_for_meeting": {
      const data = PrepareForMeetingSchema.parse(payload);
      return prepareForMeeting(data);
    }

    case "create_follow_up_task": {
      const data = CreateFollowUpTaskSchema.parse(payload);
      const collaborator = await resolveCollaborator(data.collaboratorId, data.collaboratorName);
      const description = [
        collaborator ? `Collaborator: ${collaborator.name}` : null,
        data.topic ? `Topic: ${data.topic}` : null,
      ].filter(Boolean).join("\n");
      const { data: task, error } = await supabase
        .from("Task")
        .insert({
          title: data.title,
          description: description || null,
          dueDate: data.dueDate ?? null,
          status: "open",
          source: "manual",
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (collaborator && data.dueDate) {
        await supabase
          .from("Collaborator")
          .update({ nextFollowUpDate: data.dueDate })
          .eq("id", collaborator.id);
      }
      return { kind: "follow_up_task", task, collaborator };
    }

    case "update_collaborator": {
      const data = UpdateCollaboratorSchema.parse(payload);
      const { id, ...updates } = data;
      const { data: collaborator, error } = await supabase
        .from("Collaborator")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "collaborator", record: collaborator };
    }

    case "remember_preference": {
      const data = RememberPreferenceSchema.parse(payload);
      const { data: item, error } = await supabase
        .from("ContextItem")
        .insert({
          category: "preference",
          title: data.title,
          description: data.description ?? null,
          value: data.value ?? null,
          isActive: true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "preference", record: item };
    }

    case "plan_my_day":
      EmptyObjectSchema.parse(payload);
      return planMyDay();

    case "triage_email_signals":
      EmptyObjectSchema.parse(payload);
      return triageEmailSignals();

    case "weekly_review":
      EmptyObjectSchema.parse(payload);
      return weeklyReview();

    case "relationship_checkup":
      EmptyObjectSchema.parse(payload);
      return relationshipCheckup();

    case "decision_log_entry": {
      const data = DecisionLogEntrySchema.parse(payload);
      const { data: entry, error } = await supabase
        .from("DecisionLogEntry")
        .insert({
          title: data.title,
          decision: data.decision,
          rationale: data.rationale ?? null,
          expectedOutcome: data.expectedOutcome ?? null,
          confidence: data.confidence ?? null,
          reviewDate: data.reviewDate ?? null,
          sourceJson: JSON.stringify(data.source ?? { source: "agent" }),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { kind: "decision_log_entry", record: entry };
    }
  }
}

function normalizeRelationshipType(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.toLowerCase().trim();
  if (["client", "prospect", "lead", "user"].includes(normalized)) return "customer";
  if (["coworker", "co-worker", "colleague", "employee", "internal"].includes(normalized)) {
    return "teammate";
  }
  if (["vendor", "agency", "consultant", "external"].includes(normalized)) return "partner";
  if (["mentor", "coach"].includes(normalized)) return "advisor";
  return normalized;
}

async function selectEmailSignals(selection: z.infer<typeof EmailSignalSelectionSchema>) {
  const ids = [...(selection.signalIds ?? []), ...(selection.signalId ? [selection.signalId] : [])];
  let query = supabase
    .from("EmailSignal")
    .select("*, EmailThreadCache(subject, gmailThreadId, summary, lastMessageAt)")
    .order("createdAt", { ascending: false })
    .limit(selection.limit);

  if (ids.length > 0) query = query.in("id", ids);
  else query = query.eq("state", "open");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateEmailSignalState(ids: string[], state: "accepted" | "dismissed") {
  if (ids.length === 0) return;
  const { error } = await supabase.from("EmailSignal").update({ state }).in("id", ids);
  if (error) throw new Error(error.message);
}

async function findCollaboratorByEmail(email: string) {
  const { data, error } = await supabase
    .from("Collaborator")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function collectEmailCollaboratorCandidates(
  input: z.infer<typeof CreateCollaboratorsFromEmailSchema>
) {
  const byKey = new Map<string, { name?: string; email?: string; role?: string; context?: string }>();

  const addCandidate = (candidate: { name?: string | null; email?: string | null; role?: string | null; context?: string | null }) => {
    const email = candidate.email?.trim().toLowerCase() || undefined;
    const name = candidate.name?.trim() || undefined;
    const key = email || name?.toLowerCase();
    if (!key) return;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name,
        email,
        role: candidate.role ?? undefined,
        context: candidate.context ?? undefined,
      });
    }
  };

  if (input.signalIds?.length) {
    const { data, error } = await supabase
      .from("EmailSignal")
      .select("collaboratorId, title, rationale")
      .in("id", input.signalIds);
    if (error) throw new Error(error.message);
    for (const signal of data ?? []) {
      addCandidate({ name: signal.title, context: signal.rationale });
    }
  }

  let threadQuery = supabase
    .from("EmailThreadCache")
    .select("*")
    .eq("isArchived", false)
    .order("lastMessageAt", { ascending: false })
    .limit(input.limit);
  if (input.threadIds?.length) threadQuery = threadQuery.in("id", input.threadIds);

  const { data: threads, error } = await threadQuery;
  if (error) throw new Error(error.message);

  for (const thread of threads ?? []) {
    const participants = safeParseJson<Array<{ name?: string; email?: string }>>(
      thread.participantsJson,
      []
    );
    for (const participant of participants) {
      addCandidate({
        name: participant.name,
        email: participant.email,
        context: `Participant in email thread: ${thread.subject}`,
      });
    }

    const intelligence = safeParseJson<EmailIntelligenceResult>(thread.signalsJson, {
      summary: thread.summary ?? "",
      ignoreReason: null,
      openLoops: [],
      suggestedTasks: [],
      decisions: [],
      deadlines: [],
      collaborators: [],
      projectRefs: [],
      signals: [],
    });
    for (const collaborator of intelligence.collaborators ?? []) {
      addCandidate({
        name: collaborator.name,
        email: collaborator.email,
        context: collaborator.context,
      });
    }
  }

  return Array.from(byKey.values()).slice(0, input.limit);
}

async function resolveCollaborator(id?: string, name?: string) {
  if (id) {
    const { data, error } = await supabase
      .from("Collaborator")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  if (!name) return null;
  const { data, error } = await supabase
    .from("Collaborator")
    .select("*")
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function prepareForMeeting(input: z.infer<typeof PrepareForMeetingSchema>) {
  let query = supabase
    .from("CalendarEventCache")
    .select("*")
    .gte("endTime", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("startTime", { ascending: true })
    .limit(1);
  if (input.eventId) query = query.eq("googleEventId", input.eventId);
  else if (input.title) query = query.ilike("title", `%${input.title}%`);

  const { data: event, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) return { kind: "meeting_prep", event: null, message: "No matching meeting found." };

  const attendees = safeParseJson<Array<{ email: string; displayName?: string }>>(
    event.attendeesJson,
    []
  );
  const attendeeEmails = attendees.map((attendee) => attendee.email).filter(Boolean);
  const [{ data: collaborators }, { data: emailThreads }, { data: tasks }] = await Promise.all([
    attendeeEmails.length
      ? supabase.from("Collaborator").select("*").in("email", attendeeEmails)
      : Promise.resolve({ data: [] }),
    supabase
      .from("EmailThreadCache")
      .select("subject, summary, lastMessageAt")
      .eq("isArchived", false)
      .order("lastMessageAt", { ascending: false })
      .limit(5),
    supabase
      .from("Task")
      .select("*")
      .neq("status", "done")
      .order("manualPriority", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  return {
    kind: "meeting_prep",
    event,
    attendees,
    collaborators: collaborators ?? [],
    relatedEmailThreads: emailThreads ?? [],
    openTasks: tasks ?? [],
  };
}

async function planMyDay() {
  const now = new Date().toISOString();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const [{ data: tasks }, { data: events }, { data: signals }] = await Promise.all([
    supabase
      .from("Task")
      .select("*")
      .neq("status", "done")
      .order("manualPriority", { ascending: true, nullsFirst: false })
      .order("aiPriority", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("CalendarEventCache")
      .select("*")
      .gte("startTime", now)
      .lte("startTime", todayEnd.toISOString())
      .order("startTime", { ascending: true }),
    supabase
      .from("EmailSignal")
      .select("*")
      .eq("state", "open")
      .order("createdAt", { ascending: false })
      .limit(5),
  ]);
  return { kind: "day_plan", priorities: tasks ?? [], calendar: events ?? [], emailSignals: signals ?? [] };
}

async function triageEmailSignals() {
  const { data, error } = await supabase
    .from("EmailSignal")
    .select("*, EmailThreadCache(subject, summary, lastMessageAt)")
    .eq("state", "open")
    .order("createdAt", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const signals = data ?? [];
  return {
    kind: "email_triage",
    tasks: signals.filter((signal) => signal.type === "task"),
    decisions: signals.filter((signal) => signal.type === "decision"),
    followUps: signals.filter((signal) => signal.type === "follow_up"),
    deadlines: signals.filter((signal) => signal.type === "deadline"),
    context: signals.filter((signal) => signal.type === "context"),
    fyi: signals.filter((signal) => signal.type === "fyi"),
  };
}

async function weeklyReview() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: completedTasks }, { data: openTasks }, { data: notes }, { data: signals }] = await Promise.all([
    supabase.from("Task").select("*").eq("status", "done").gte("completedAt", since).limit(25),
    supabase.from("Task").select("*").neq("status", "done").order("createdAt", { ascending: false }).limit(25),
    supabase.from("NoteExtraction").select("*").gte("extractedAt", since).limit(10),
    supabase.from("EmailSignal").select("*").eq("state", "open").gte("createdAt", since).limit(25),
  ]);
  return {
    kind: "weekly_review",
    completedTasks: completedTasks ?? [],
    openTasks: openTasks ?? [],
    recentNoteExtractions: notes ?? [],
    openEmailSignals: signals ?? [],
  };
}

async function relationshipCheckup() {
  const { data, error } = await supabase
    .from("Collaborator")
    .select("*")
    .order("importanceLevel", { ascending: false })
    .order("nextFollowUpDate", { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const now = Date.now();
  const collaborators = data ?? [];
  return {
    kind: "relationship_checkup",
    overdue: collaborators.filter((collaborator) =>
      collaborator.nextFollowUpDate
        ? new Date(collaborator.nextFollowUpDate).getTime() < now
        : false
    ),
    importantWithoutCadence: collaborators.filter(
      (collaborator) => collaborator.importanceLevel >= 4 && !collaborator.preferredCadence
    ),
    all: collaborators,
  };
}
