import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import type { CalendarEvent, ProposedAction } from "@/types/calendar";

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    expiry_date: process.env.GOOGLE_TOKEN_EXPIRY
      ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY)
      : undefined,
  });

  oauth2Client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      persistTokens(tokens.access_token, tokens.expiry_date ?? null);
    }
  });

  return oauth2Client;
}

function persistTokens(accessToken: string, expiryDate: number | null) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let content = fs.readFileSync(envPath, "utf-8");
    content = content
      .replace(/^GOOGLE_ACCESS_TOKEN=.*/m, `GOOGLE_ACCESS_TOKEN="${accessToken}"`)
      .replace(
        /^GOOGLE_TOKEN_EXPIRY=.*/m,
        `GOOGLE_TOKEN_EXPIRY="${expiryDate ?? ""}"`
      );
    fs.writeFileSync(envPath, content);
    process.env.GOOGLE_ACCESS_TOKEN = accessToken;
    if (expiryDate) process.env.GOOGLE_TOKEN_EXPIRY = String(expiryDate);
  } catch {
    // Non-fatal — token will still work for this request
  }
}

function mapGoogleEvent(e: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: e.id!,
    title: e.summary ?? "(No title)",
    description: e.description,
    startTime: e.start!.dateTime!,
    endTime: e.end!.dateTime!,
    location: e.location ?? undefined,
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      displayName: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    })),
    organizerEmail: e.organizer?.email,
    htmlLink: e.htmlLink ?? undefined,
  };
}

export async function fetchCalendarEvents({
  startDate,
  endDate,
  maxResults = 100,
}: {
  startDate: Date | string;
  endDate: Date | string;
  maxResults?: number;
}): Promise<CalendarEvent[]> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date(startDate).toISOString(),
    timeMax: new Date(endDate).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults,
  });

  const items = response.data.items ?? [];
  return items
    .filter((e) => e.start?.dateTime)
    .map(mapGoogleEvent);
}

export async function fetchUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return fetchCalendarEvents({ startDate: now, endDate: end, maxResults: 50 });
}

export async function createCalendarEvent(
  title: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<string> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description: description ?? "[DruckerAI] Focus block",
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      colorId: "9", // blueberry — visually distinct for focus blocks
    },
  });

  return response.data.id!;
}

export async function applyCalendarAction(
  eventId: string,
  action: ProposedAction
): Promise<void> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  switch (action.type) {
    case "delete": {
      await calendar.events.delete({ calendarId: "primary", eventId });
      break;
    }
    case "shorten": {
      await calendar.events.patch({
        calendarId: "primary",
        eventId,
        requestBody: {
          end: { dateTime: action.parameters?.newEndTime },
        },
      });
      break;
    }
    case "move": {
      await calendar.events.patch({
        calendarId: "primary",
        eventId,
        requestBody: {
          start: { dateTime: action.parameters?.newStartTime },
          end: { dateTime: action.parameters?.newEndTime },
        },
      });
      break;
    }
    case "add_prep_time": {
      const ev = await calendar.events.get({ calendarId: "primary", eventId });
      const prepMins = action.parameters?.prepMinutes ?? 15;
      const eventStart = new Date(ev.data.start!.dateTime!);
      const prepStart = new Date(eventStart.getTime() - prepMins * 60000);
      await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `Prep: ${ev.data.summary}`,
          start: { dateTime: prepStart.toISOString() },
          end: { dateTime: eventStart.toISOString() },
          colorId: "5",
        },
      });
      break;
    }
    case "add_follow_up": {
      const ev = await calendar.events.get({ calendarId: "primary", eventId });
      const followMins = action.parameters?.followUpMinutes ?? 15;
      const eventEnd = new Date(ev.data.end!.dateTime!);
      const followEnd = new Date(eventEnd.getTime() + followMins * 60000);
      await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `Follow-up: ${ev.data.summary}`,
          start: { dateTime: eventEnd.toISOString() },
          end: { dateTime: followEnd.toISOString() },
          colorId: "2",
        },
      });
      break;
    }
    case "ask_for_agenda":
    case "ask_to_reschedule":
    case "convert_to_async": {
      const ev = await calendar.events.get({ calendarId: "primary", eventId });
      const note = action.parameters?.message ?? action.description;
      const existingDesc = ev.data.description ?? "";
      await calendar.events.patch({
        calendarId: "primary",
        eventId,
        requestBody: {
          description: existingDesc
            ? `${existingDesc}\n\n[DruckerAI] ${note}`
            : `[DruckerAI] ${note}`,
        },
      });
      break;
    }
    case "keep":
    default:
      break;
  }
}
