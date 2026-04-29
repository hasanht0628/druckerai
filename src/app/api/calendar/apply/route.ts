import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { applyCalendarAction } from "@/lib/google-calendar";
import type { ProposedAction } from "@/types/calendar";

export async function POST(request: NextRequest) {
  const { eventId, action } = await request.json() as { eventId: string; action: ProposedAction };

  await applyCalendarAction(eventId, action);

  await supabase
    .from("CalendarEventCache")
    .update({ userAction: "approved" })
    .eq("googleEventId", eventId);

  return NextResponse.json({ ok: true });
}
