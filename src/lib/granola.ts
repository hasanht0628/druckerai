import type { GranolaMeeting } from "@/types/notes";

const GRANOLA_BASE = "https://public-api.granola.ai/v1";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.GRANOLA_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export function isGranolaConfigured(): boolean {
  return Boolean(process.env.GRANOLA_API_TOKEN);
}

export async function fetchRecentMeetings(limit = 20): Promise<GranolaMeeting[]> {
  const res = await fetch(`${GRANOLA_BASE}/notes?page_size=${Math.min(limit, 30)}`, {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Granola API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const notes: Record<string, unknown>[] = data.notes ?? [];

  return notes.map((n) => ({
    id: String(n.id ?? ""),
    title: String(n.title ?? "Untitled meeting"),
    date: String(n.created_at ?? ""),
  }));
}

export async function fetchMeetingById(id: string): Promise<GranolaMeeting> {
  const res = await fetch(`${GRANOLA_BASE}/notes/${id}?include=transcript`, {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Granola API error: ${res.status} ${res.statusText}`);
  }

  const n = await res.json();

  let notes = (n.summary_markdown ?? n.summary_text ?? "") as string;

  if (Array.isArray(n.transcript) && n.transcript.length > 0) {
    const transcriptText = (n.transcript as Array<{ speaker?: { source?: string; diarization_label?: string }; text: string }>)
      .map((t) => {
        const speaker = t.speaker?.diarization_label ?? t.speaker?.source ?? "Speaker";
        return `${speaker}: ${t.text}`;
      })
      .join("\n");
    notes = notes ? `${notes}\n\n## Transcript\n${transcriptText}` : transcriptText;
  }

  return {
    id: String(n.id ?? id),
    title: String(n.title ?? "Untitled meeting"),
    date: String(n.created_at ?? ""),
    notes,
  };
}
