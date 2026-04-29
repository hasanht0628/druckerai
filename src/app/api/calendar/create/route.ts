import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createCalendarEvent } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const { title, startTime, endTime, description } = await request.json() as {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
  };

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: "title, startTime, and endTime are required" }, { status: 400 });
  }

  try {
    const eventId = await createCalendarEvent(title, startTime, endTime, description);
    return NextResponse.json({ eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create calendar event";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
