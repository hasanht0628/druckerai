import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import {
  fetchThreadMessages,
  isGmailConfigured,
  isLikelyImportantThread,
  listRecentThreads,
} from "@/lib/google-gmail";
import { extractEmailIntelligence } from "@/lib/prompts/email-intelligence";
import type { EmailSignal } from "@/types/email";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isGmailConfigured()) {
    return NextResponse.json(
      { error: "Gmail not configured. Re-run scripts/setup-google-auth.js to add Gmail read-only scope." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({})) as {
    maxResults?: number;
    query?: string;
  };
  const maxResults = Math.min(body.maxResults ?? 15, 30);

  const [{ data: contextItems }, { data: collaborators }] = await Promise.all([
    supabase.from("ContextItem").select("*").eq("isActive", true),
    supabase.from("Collaborator").select("*").order("importanceLevel", { ascending: false }),
  ]);

  const collaboratorByEmail = new Map(
    (collaborators ?? [])
      .filter((collaborator) => collaborator.email)
      .map((collaborator) => [String(collaborator.email).toLowerCase(), collaborator])
  );

  const threadRefs = await listRecentThreads(maxResults, body.query);
  const results = [];

  for (const threadRef of threadRefs) {
    const thread = await fetchThreadMessages(threadRef.id);
    if (!isLikelyImportantThread(thread)) {
      results.push({
        threadId: thread.threadId,
        subject: thread.subject,
        ignored: true,
        reason: "Filtered before AI: low-signal Gmail category, automated sender, or update-style subject",
        signals: 0,
      });
      continue;
    }

    const intelligence = await extractEmailIntelligence(
      thread,
      (contextItems ?? []) as Parameters<typeof extractEmailIntelligence>[1],
      (collaborators ?? []) as Parameters<typeof extractEmailIntelligence>[2]
    );

    const { data: cached, error } = await supabase
      .from("EmailThreadCache")
      .upsert(
        {
          gmailThreadId: thread.threadId,
          subject: thread.subject,
          participantsJson: JSON.stringify(thread.participants),
          lastMessageAt: thread.lastMessageAt,
          snippet: thread.snippet ?? null,
          summary: intelligence.summary || null,
          signalsJson: JSON.stringify(intelligence),
          labelsJson: JSON.stringify(thread.labels),
          isArchived: Boolean(intelligence.ignoreReason),
          syncedAt: new Date().toISOString(),
        },
        { onConflict: "gmailThreadId" }
      )
      .select()
      .single();

    if (error) {
      results.push({ threadId: thread.threadId, subject: thread.subject, error: error.message });
      continue;
    }

    await supabase.from("EmailSignal").delete().eq("threadId", cached.id);

    const signals = normalizeSignals(intelligence.signals);
    if (!intelligence.ignoreReason && signals.length > 0) {
      await supabase.from("EmailSignal").insert(
        signals.map((signal) => ({
          threadId: cached.id,
          type: signal.type,
          title: signal.title,
          rationale: signal.rationale ?? null,
          dueDate: signal.dueDate ?? null,
          collaboratorId: signal.collaboratorEmail
            ? collaboratorByEmail.get(signal.collaboratorEmail.toLowerCase())?.id ?? null
            : null,
          confidence: signal.confidence ?? null,
          state: "open",
        }))
      );
    }

    results.push({
      threadId: thread.threadId,
      subject: thread.subject,
      ignored: Boolean(intelligence.ignoreReason),
      signals: signals.length,
    });
  }

  const analyzed = results.filter((result) => !result.ignored && !result.error).length;
  const filtered = results.filter((result) => result.ignored).length;

  return NextResponse.json({ synced: results.length, analyzed, filtered, results });
}

function normalizeSignals(signals: EmailSignal[]): EmailSignal[] {
  return signals
    .filter((signal) => signal.title?.trim())
    .map((signal) => ({
      ...signal,
      title: signal.title.trim(),
      confidence:
        typeof signal.confidence === "number"
          ? Math.max(0, Math.min(signal.confidence, 1))
          : null,
    }));
}
