/**
 * DruckerAI Prompt Evals
 * Run: npm run eval
 *
 * Validates that each prompt returns structurally correct output.
 * Catches schema regressions before they reach production.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import OpenAI from "openai";

// ─── Load prompts via relative paths (tsx doesn't need Next.js path aliases) ───
import { buildCalendarScoringMessages } from "../src/lib/prompts/calendar-scoring";
import { buildCalendarActionsMessages } from "../src/lib/prompts/calendar-actions";
import { buildNoteExtractionMessages } from "../src/lib/prompts/note-extraction";
import { buildTaskPrioritizationMessages } from "../src/lib/prompts/task-prioritization";
import { buildDailyBriefMessages } from "../src/lib/prompts/daily-brief";

import type { CalendarEvent, ScoredEvent } from "../src/types/calendar";
import type { Task } from "../src/types/task";
import type { ContextItem } from "../src/types/context";
import type { Collaborator } from "../src/types/collaborator";

// ─── ANSI colors ──────────────────────────────────────────────────────────────
const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const B = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = new Date();
const fmt = (d: Date) => d.toISOString();
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

const contextItems: ContextItem[] = [
  {
    id: "ctx-1", category: "project", title: "Series A fundraise",
    description: "Raise $5M by Q3", isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "ctx-2", category: "goal", title: "Ship v2.0 by July 1",
    description: "Core feature complete with 3 design partners", isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "ctx-3", category: "deadline", title: "Board deck due Friday",
    value: new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0],
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "ctx-4", category: "constraint", title: "Engineering team at capacity",
    description: "No new hires until Q4", isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  },
];

const collaborators: Collaborator[] = [
  {
    id: "col-1", name: "Sarah Chen", email: "sarah@accel.vc",
    role: "Lead investor", relationshipType: "investor", importanceLevel: 5,
    nextFollowUpDate: new Date(Date.now() - 2 * 86_400_000),
    lastContactDate: new Date(Date.now() - 14 * 86_400_000),
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "col-2", name: "Marcus Reid", email: "marcus@designpartner.com",
    role: "Design partner CEO", relationshipType: "customer", importanceLevel: 4,
    nextFollowUpDate: new Date(Date.now() + 5 * 86_400_000),
    lastContactDate: new Date(Date.now() - 7 * 86_400_000),
    createdAt: new Date(), updatedAt: new Date(),
  },
];

const tasks: Task[] = [
  {
    id: "task-1", title: "Draft Series A pitch deck", status: "open",
    description: "15-slide deck for investor meetings",
    source: "manual", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "task-2", title: "Review Q2 OKR progress", status: "open",
    description: "Prepare for board review on Friday",
    source: "manual", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "task-3", title: "Respond to Marcus on API timeline", status: "open",
    description: "He asked about the v2 API availability for their integration",
    source: "note_extraction", createdAt: new Date(), updatedAt: new Date(),
  },
];

const calendarEvents: CalendarEvent[] = [
  {
    id: "evt-1", title: "Board meeting prep call",
    description: "Sync with Sarah before the board deck deadline",
    startTime: fmt(addHours(TODAY, 2)), endTime: fmt(addHours(TODAY, 3)),
    attendees: [{ email: "sarah@accel.vc", displayName: "Sarah Chen" }],
    organizerEmail: "me@company.com",
  },
  {
    id: "evt-2", title: "Weekly all-hands standup",
    description: "Full team sync, 30 min",
    startTime: fmt(addHours(TODAY, 5)), endTime: fmt(addHours(TODAY, 5.5)),
    attendees: [
      { email: "eng1@company.com" }, { email: "eng2@company.com" },
      { email: "design@company.com" },
    ],
    organizerEmail: "me@company.com",
  },
  {
    id: "evt-3", title: "Coffee chat — recruiter cold outreach",
    description: "Intro call with recruiter I don't know",
    startTime: fmt(addHours(TODAY, 8)), endTime: fmt(addHours(TODAY, 8.75)),
    attendees: [{ email: "recruiter@staffing.com" }],
    organizerEmail: "recruiter@staffing.com",
  },
];

const scoredEvent: ScoredEvent = {
  ...calendarEvents[0],
  scores: {
    importance: 9, urgency: 8, contribution: 8,
    relationship_value: 10, project_alignment: 9,
  },
  overall: 88,
  rationale: "Critical prep session with lead investor before board deadline. Directly supports Series A fundraise and board deck preparation.",
  primaryConcern: "keep",
  flags: ["key_relationship"],
};

const meetingNotes = `
Team strategy session - April 25, 2026

Attendees: me, Marcus Reid (design partner), Sarah Chen (investor)

We reviewed Q2 OKR progress. We are 70% toward our v2.0 milestone.
Key blocker: the API documentation is still incomplete.

Decisions made:
- Ship v2 API in beta by May 15 to unblock Marcus's integration
- Delay new feature work until June to keep team focused
- Sarah will intro us to two other VCs next week

Action items:
- I need to write the API migration guide by May 10
- Marcus's team to provide feedback on beta by May 20
- Schedule a follow-up with Sarah's intros before May 12

Open questions:
- Should we hire a technical writer or do it in-house?
- What's the pricing model for the v2 API tier?
`;

// ─── OpenAI client ────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o";

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// ─── JSON parsing ────────────────────────────────────────────────────────────

type ParseResult = { value: unknown; wrappedInMarkdown: boolean } | null;

function tryParse(raw: string): ParseResult {
  try {
    return { value: JSON.parse(raw), wrappedInMarkdown: false };
  } catch {
    // Strip ```json ... ``` or ``` ... ``` fences and retry
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    try {
      return { value: JSON.parse(stripped), wrappedInMarkdown: true };
    } catch {
      return null;
    }
  }
}

// ─── Assertions ───────────────────────────────────────────────────────────────

type Check = { name: string; pass: boolean; detail?: string };

function check(name: string, condition: boolean, detail?: string): Check {
  return { name, pass: condition, detail };
}

const VALID_FLAGS = new Set(["no_agenda", "could_be_async", "conflicts_with_deadline", "key_relationship"]);
const VALID_CONCERN = new Set(["keep", "challenge", "eliminate"]);
const VALID_IMPACT = new Set(["high", "medium", "low"]);
const VALID_PRIORITY = new Set(["critical", "high", "medium", "low"]);
const VALID_ACTION_TYPES = new Set([
  "keep", "delete", "move", "shorten", "add_prep_time",
  "add_follow_up", "ask_for_agenda", "ask_to_reschedule", "convert_to_async",
]);
const VALID_CALENDAR_UPDATE_TYPES = new Set(["add_prep", "add_follow_up", "schedule_new", "reschedule"]);
const VALID_CONTEXT_CATEGORIES = new Set(["project", "goal", "deadline", "constraint", "priority"]);
const VALID_CONTEXT_ACTIONS = new Set(["add", "update", "complete"]);
const VALID_URGENCY = new Set(["high", "medium"]);

function inRange(n: unknown, min: number, max: number): boolean {
  return typeof n === "number" && n >= min && n <= max;
}

function isNonEmptyString(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

// ─── Eval runners ─────────────────────────────────────────────────────────────

async function evalCalendarScoring(): Promise<Check[]> {
  const { systemPrompt, userMessage } = buildCalendarScoringMessages(
    calendarEvents, contextItems, collaborators, []
  );
  const raw = await callLLM(systemPrompt, userMessage);
  const parseResult = tryParse(raw);
  if (!parseResult) return [check("Valid JSON array", false, raw.slice(0, 200))];

  const checks: Check[] = [];
  if (parseResult.wrappedInMarkdown) checks.push(check("No markdown wrapper (breaks production JSON.parse)", false));
  const parsed = parseResult.value;
  const arr = parsed as Record<string, unknown>[];

  checks.push(check("Is JSON array", Array.isArray(parsed)));
  if (!Array.isArray(parsed)) return checks;

  checks.push(check(`Output count matches input (${calendarEvents.length})`, arr.length === calendarEvents.length));

  const inputIds = new Set(calendarEvents.map((e) => e.id));
  const outputIds = new Set(arr.map((r) => r.eventId as string));
  checks.push(check("All input event IDs present in output", inputIds.size === outputIds.size && [...inputIds].every((id) => outputIds.has(id))));

  const scoreKeys = ["importance", "urgency", "contribution", "relationship_value", "project_alignment"] as const;
  let allScoresValid = true;
  let allOverallValid = true;
  let allConcernValid = true;
  let allFlagsValid = true;

  for (const item of arr) {
    const scores = item.scores as Record<string, unknown>;
    if (!scores || typeof scores !== "object") { allScoresValid = false; continue; }
    for (const k of scoreKeys) {
      if (!inRange(scores[k], 0, 10)) allScoresValid = false;
    }
    if (!inRange(item.overall, 0, 100)) allOverallValid = false;
    if (!VALID_CONCERN.has(item.primaryConcern as string)) allConcernValid = false;
    if (Array.isArray(item.flags)) {
      for (const f of item.flags as unknown[]) {
        if (!VALID_FLAGS.has(f as string)) allFlagsValid = false;
      }
    }
  }

  checks.push(check("All individual scores in [0, 10]", allScoresValid));
  checks.push(check("All overall scores in [0, 100]", allOverallValid));
  checks.push(check("All primaryConcern values valid", allConcernValid));
  checks.push(check("All flags are valid enum values", allFlagsValid));
  checks.push(check("All items have non-empty rationale", arr.every((r) => isNonEmptyString(r.rationale))));
  checks.push(check("taskSuggestions field is array on each item", arr.every((r) => Array.isArray(r.taskSuggestions))));

  return checks;
}

async function evalCalendarActions(): Promise<Check[]> {
  const { systemPrompt, userMessage } = buildCalendarActionsMessages(scoredEvent);
  const raw = await callLLM(systemPrompt, userMessage);
  const parseResult = tryParse(raw);
  if (!parseResult) return [check("Valid JSON array", false, raw.slice(0, 200))];

  const checks: Check[] = [];
  if (parseResult.wrappedInMarkdown) checks.push(check("No markdown wrapper (breaks production JSON.parse)", false));
  const parsed = parseResult.value;
  checks.push(check("Is JSON array", Array.isArray(parsed)));
  if (!Array.isArray(parsed)) return checks;

  const arr = parsed as Record<string, unknown>[];
  checks.push(check("1–3 actions returned", arr.length >= 1 && arr.length <= 3,
    `Got ${arr.length}`));
  checks.push(check("All action types are valid", arr.every((a) => VALID_ACTION_TYPES.has(a.type as string))));
  checks.push(check("All confidence values in [0, 1]", arr.every((a) => inRange(a.confidence, 0, 1))));
  checks.push(check("All descriptions are non-empty strings", arr.every((a) => isNonEmptyString(a.description))));

  // Behavioral: score > 70 → "keep" must be present
  const types = new Set(arr.map((a) => a.type));
  checks.push(check(`"keep" present (score=${scoredEvent.overall} > 70)`, types.has("keep")));

  return checks;
}

async function evalNoteExtraction(): Promise<Check[]> {
  const { systemPrompt, userMessage } = buildNoteExtractionMessages(
    meetingNotes, contextItems, collaborators, []
  );
  const raw = await callLLM(systemPrompt, userMessage);
  const parseResult = tryParse(raw);
  if (!parseResult) return [check("Valid JSON object", false, raw.slice(0, 200))];

  const checks: Check[] = [];
  if (parseResult.wrappedInMarkdown) checks.push(check("No markdown wrapper (breaks production JSON.parse)", false));
  const parsed = parseResult.value;
  const obj = parsed as Record<string, unknown>;

  checks.push(check("Is JSON object", typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null));

  const requiredKeys = ["decisions", "openQuestions", "actionItems", "followUps", "strategicInsights", "calendarUpdates", "contextUpdates"];
  checks.push(check("Has all required top-level keys", requiredKeys.every((k) => k in obj),
    `Missing: ${requiredKeys.filter((k) => !(k in obj)).join(", ")}`));

  checks.push(check("decisions is array", Array.isArray(obj.decisions)));
  if (Array.isArray(obj.decisions)) {
    checks.push(check("Each decision has text + valid impact",
      (obj.decisions as Record<string, unknown>[]).every(
        (d) => isNonEmptyString(d.text) && VALID_IMPACT.has(d.impact as string)
      )));
  }

  checks.push(check("openQuestions is array of strings", Array.isArray(obj.openQuestions) &&
    (obj.openQuestions as unknown[]).every((q) => typeof q === "string")));

  checks.push(check("actionItems is array", Array.isArray(obj.actionItems)));
  if (Array.isArray(obj.actionItems)) {
    checks.push(check("Each actionItem has task + valid priority",
      (obj.actionItems as Record<string, unknown>[]).every(
        (a) => isNonEmptyString(a.task) && VALID_PRIORITY.has(a.priority as string)
      )));
  }

  checks.push(check("followUps is array", Array.isArray(obj.followUps)));
  if (Array.isArray(obj.followUps)) {
    checks.push(check("Each followUp has collaboratorName + topic",
      (obj.followUps as Record<string, unknown>[]).every(
        (f) => isNonEmptyString(f.collaboratorName) && isNonEmptyString(f.topic)
      )));
  }

  checks.push(check("calendarUpdates is array", Array.isArray(obj.calendarUpdates)));
  if (Array.isArray(obj.calendarUpdates)) {
    checks.push(check("Each calendarUpdate has valid type",
      (obj.calendarUpdates as Record<string, unknown>[]).every(
        (c) => VALID_CALENDAR_UPDATE_TYPES.has(c.type as string)
      )));
  }

  checks.push(check("contextUpdates is array", Array.isArray(obj.contextUpdates)));
  if (Array.isArray(obj.contextUpdates)) {
    checks.push(check("Each contextUpdate has valid category + action",
      (obj.contextUpdates as Record<string, unknown>[]).every(
        (c) => VALID_CONTEXT_CATEGORIES.has(c.category as string) &&
               VALID_CONTEXT_ACTIONS.has(c.action as string)
      )));
  }

  return checks;
}

async function evalTaskPrioritization(): Promise<Check[]> {
  const { systemPrompt, userMessage } = buildTaskPrioritizationMessages(
    tasks, contextItems, []
  );
  const raw = await callLLM(systemPrompt, userMessage);
  const parseResult = tryParse(raw);
  if (!parseResult) return [check("Valid JSON array", false, raw.slice(0, 200))];

  const checks: Check[] = [];
  if (parseResult.wrappedInMarkdown) checks.push(check("No markdown wrapper (breaks production JSON.parse)", false));
  const parsed = parseResult.value;
  checks.push(check("Is JSON array", Array.isArray(parsed)));
  if (!Array.isArray(parsed)) return checks;

  const arr = parsed as Record<string, unknown>[];
  const inputIds = new Set(tasks.map((t) => t.id));
  const outputIds = new Set(arr.map((r) => r.id as string));

  checks.push(check(`Output count matches input (${tasks.length})`, arr.length === tasks.length, `Got ${arr.length}`));
  checks.push(check("All input task IDs present in output",
    inputIds.size === outputIds.size && [...inputIds].every((id) => outputIds.has(id))));
  checks.push(check("All priorityLabel values valid",
    arr.every((r) => VALID_PRIORITY.has(r.priorityLabel as string))));
  checks.push(check("All aiPriority values are positive integers",
    arr.every((r) => typeof r.aiPriority === "number" && r.aiPriority >= 1 && Number.isInteger(r.aiPriority))));

  const priorities = arr.map((r) => r.aiPriority as number);
  checks.push(check("No duplicate aiPriority values",
    new Set(priorities).size === priorities.length));
  checks.push(check("All priorityReason fields are non-empty strings",
    arr.every((r) => isNonEmptyString(r.priorityReason))));

  return checks;
}

async function evalDailyBrief(): Promise<Check[]> {
  const { systemPrompt, userMessage } = buildDailyBriefMessages(
    [scoredEvent], tasks, contextItems, collaborators, []
  );
  const raw = await callLLM(systemPrompt, userMessage);
  const parseResult = tryParse(raw);
  if (!parseResult) return [check("Valid JSON object", false, raw.slice(0, 200))];

  const checks: Check[] = [];
  if (parseResult.wrappedInMarkdown) checks.push(check("No markdown wrapper (breaks production JSON.parse)", false));
  const parsed = parseResult.value;
  const obj = parsed as Record<string, unknown>;

  checks.push(check("Is JSON object", typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null));

  const requiredKeys = ["date", "topPriorities", "meetingsToProtect", "meetingsToChallenge", "decisionsAwaiting", "focusBlocks", "overdueFollowUps"];
  checks.push(check("Has all required top-level keys", requiredKeys.every((k) => k in obj),
    `Missing: ${requiredKeys.filter((k) => !(k in obj)).join(", ")}`));

  const todayStr = TODAY.toISOString().split("T")[0];
  checks.push(check(`date is today's date (${todayStr})`, obj.date === todayStr, `Got: ${obj.date}`));

  checks.push(check("topPriorities is array", Array.isArray(obj.topPriorities)));
  if (Array.isArray(obj.topPriorities)) {
    const tp = obj.topPriorities as Record<string, unknown>[];
    checks.push(check("topPriorities has exactly 3 items", tp.length === 3, `Got ${tp.length}`));
    const ranks = tp.map((p) => p.rank);
    checks.push(check("topPriorities ranks are 1, 2, 3", JSON.stringify(ranks.sort()) === "[1,2,3]",
      `Got: ${JSON.stringify(ranks)}`));
    checks.push(check("Each priority has title + rationale",
      tp.every((p) => isNonEmptyString(p.title) && isNonEmptyString(p.rationale))));
  }

  checks.push(check("meetingsToProtect is array", Array.isArray(obj.meetingsToProtect)));
  checks.push(check("meetingsToChallenge is array", Array.isArray(obj.meetingsToChallenge)));
  checks.push(check("focusBlocks is array", Array.isArray(obj.focusBlocks)));

  if (Array.isArray(obj.decisionsAwaiting)) {
    checks.push(check("Each decisionsAwaiting has valid urgency",
      (obj.decisionsAwaiting as Record<string, unknown>[]).every(
        (d) => VALID_URGENCY.has(d.urgency as string)
      )));
  }

  checks.push(check("overdueFollowUps is array", Array.isArray(obj.overdueFollowUps)));
  if (Array.isArray(obj.overdueFollowUps)) {
    checks.push(check("Each overdueFollowUp has required fields",
      (obj.overdueFollowUps as Record<string, unknown>[]).every(
        (f) => isNonEmptyString(f.collaboratorName) && typeof f.daysSinceContact === "number"
      )));
  }

  return checks;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

interface EvalCase {
  name: string;
  run: () => Promise<Check[]>;
}

const EVALS: EvalCase[] = [
  { name: "Calendar Scoring (3 events)", run: evalCalendarScoring },
  { name: "Calendar Actions (scored event, overall=88)", run: evalCalendarActions },
  { name: "Note Extraction (strategy session)", run: evalNoteExtraction },
  { name: "Task Prioritization (3 tasks)", run: evalTaskPrioritization },
  { name: "Daily Brief (full context)", run: evalDailyBrief },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(`${R}Error: OPENAI_API_KEY not set. Ensure .env.local exists.${RESET}`);
    process.exit(1);
  }

  console.log(`\n${B}DruckerAI Prompt Evals${RESET}  ${DIM}model: ${MODEL}${RESET}\n`);

  let totalChecks = 0;
  let passedChecks = 0;
  let passedEvals = 0;

  for (const evalCase of EVALS) {
    process.stdout.write(`${B}EVAL:${RESET} ${evalCase.name} ... `);
    const start = Date.now();

    let checks: Check[];
    try {
      checks = await evalCase.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${R}ERROR${RESET}`);
      console.log(`  ${R}${msg}${RESET}\n`);
      continue;
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const passed = checks.filter((c) => c.pass).length;
    const allPass = passed === checks.length;

    console.log(allPass ? `${G}PASSED${RESET} ${DIM}(${passed}/${checks.length} checks, ${elapsed}s)${RESET}` : `${R}FAILED${RESET} ${DIM}(${passed}/${checks.length} checks, ${elapsed}s)${RESET}`);

    for (const c of checks) {
      const icon = c.pass ? `${G}✓${RESET}` : `${R}✗${RESET}`;
      const detail = !c.pass && c.detail ? ` ${DIM}— ${c.detail}${RESET}` : "";
      console.log(`  ${icon} ${c.name}${detail}`);
    }
    console.log();

    totalChecks += checks.length;
    passedChecks += passed;
    if (allPass) passedEvals++;
  }

  const allPass = passedEvals === EVALS.length;
  const summaryColor = allPass ? G : R;
  console.log(`${B}SUMMARY${RESET}  ${summaryColor}${passedEvals}/${EVALS.length} evals passed${RESET}  ${DIM}${passedChecks}/${totalChecks} checks passed${RESET}\n`);

  process.exit(allPass ? 0 : 1);
}

main();
