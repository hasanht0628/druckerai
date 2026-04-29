import type { ScoredEvent } from "@/types/calendar";

export interface CalendarMatch {
  event: ScoredEvent;
  confidence: number;
  reason: string;
}

export function findBestCalendarMatch({
  title,
  date,
  events,
}: {
  title?: string | null;
  date?: string | null;
  events: ScoredEvent[];
}): CalendarMatch | null {
  if (events.length === 0) return null;

  const noteDate = date ? new Date(date) : null;
  const titleTokens = tokenize(title ?? "");
  const scored = events.map((event) => {
    const eventStart = new Date(event.startTime);
    const titleScore = titleTokens.length
      ? jaccard(titleTokens, tokenize(event.title))
      : 0;
    const timeDeltaHours = noteDate
      ? Math.abs(eventStart.getTime() - noteDate.getTime()) / 3_600_000
      : 24;
    const sameDay = noteDate ? eventStart.toDateString() === noteDate.toDateString() : false;
    const timeScore = sameDay
      ? Math.max(0, 1 - Math.min(timeDeltaHours, 8) / 8)
      : 0;
    const confidence = Math.round((titleScore * 0.55 + timeScore * 0.45) * 100) / 100;

    return {
      event,
      confidence,
      reason: sameDay
        ? "Same day with similar title/time"
        : "Closest title match in visible range",
    };
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  const best = scored[0];
  return best && best.confidence >= 0.35 ? best : null;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function jaccard(a: string[], b: string[]) {
  const left = new Set(a);
  const right = new Set(b);
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "meeting",
  "sync",
  "call",
  "notes",
]);
