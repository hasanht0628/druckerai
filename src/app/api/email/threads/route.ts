import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import type { EmailIntelligenceResult, EmailParticipant } from "@/types/email";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25"), 100);

  const { data, error } = await supabase
    .from("EmailThreadCache")
    .select("*")
    .order("lastMessageAt", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((thread) => ({
      ...thread,
      participants: safeParseJson<EmailParticipant[]>(thread.participantsJson, []),
      labels: safeParseJson<string[]>(thread.labelsJson, []),
      signals: safeParseJson<EmailIntelligenceResult>(thread.signalsJson, {
        summary: "",
        ignoreReason: null,
        openLoops: [],
        suggestedTasks: [],
        decisions: [],
        deadlines: [],
        collaborators: [],
        projectRefs: [],
        signals: [],
      }),
    }))
  );
}
