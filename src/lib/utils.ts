import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "MMM d, h:mm a");
}

export function formatTime(date: Date | string) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return format(d, "h:mm a");
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function daysUntil(date: Date | string): number {
  return differenceInDays(new Date(date), new Date());
}

export function isOverdue(date: Date | string): boolean {
  return isPast(new Date(date));
}

export function safeParseJson<T>(json: string, fallback: T): T {
  const candidates = getJsonCandidates(json);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next likely JSON fragment.
    }
  }

  return fallback;
}

function getJsonCandidates(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const candidates = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  return [...new Set(candidates)];
}
