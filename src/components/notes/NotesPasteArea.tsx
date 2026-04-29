"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, Download, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { findBestCalendarMatch } from "@/lib/calendar-matching";
import { safeParseJson } from "@/lib/utils";
import type { ScoredEvent } from "@/types/calendar";
import type { NoteExtraction } from "@/types/notes";

interface Props {
  onExtractionComplete: (extraction: NoteExtraction) => void;
}

export function NotesPasteArea({ onExtractionComplete }: Props) {
  const [rawContent, setRawContent] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<"manual" | "granola">("manual");
  const [granolaId, setGranolaId] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState(() => toDateInputValue(new Date()));
  const [nearbyEvents, setNearbyEvents] = useState<ScoredEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [granolaOpen, setGranolaOpen] = useState(false);
  const [granolaLoading, setGranolaLoading] = useState(false);
  const [granolaList, setGranolaList] = useState<{ id: string; title: string; date: string; notes?: string }[]>([]);
  const streamRef = useRef<string>("");
  const selectedEvent = nearbyEvents.find((event) => event.id === selectedEventId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadNearbyEvents() {
      if (!meetingDate) {
        setNearbyEvents([]);
        setSelectedEventId("");
        return;
      }

      setEventsLoading(true);
      const { start, end } = getLocalDayRange(meetingDate);

      try {
        const res = await fetch(
          `/api/calendar/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load calendar events");
        if (cancelled) return;
        setNearbyEvents(data);
      } catch {
        if (!cancelled) setNearbyEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    }

    loadNearbyEvents();
    return () => {
      cancelled = true;
    };
  }, [meetingDate]);

  useEffect(() => {
    if (selectedEventId || nearbyEvents.length === 0) return;
    const match = findBestCalendarMatch({
      title,
      date: getLocalDayRange(meetingDate).start.toISOString(),
      events: nearbyEvents,
    });
    if (match) setSelectedEventId(match.event.id);
  }, [meetingDate, nearbyEvents, selectedEventId, title]);

  async function handleExtract() {
    if (!rawContent.trim()) {
      toast.error("Paste some notes first");
      return;
    }

    setSaving(true);

    // Save note first
    const noteRes = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || null,
        rawContent,
        source,
        granolaId,
        meetingDate: meetingDate || null,
        googleEventId: selectedEvent?.id ?? null,
        calendarEventTitle: selectedEvent?.title ?? null,
        calendarEventStartTime: selectedEvent?.startTime ?? null,
      }),
    });

    if (!noteRes.ok) {
      const error = await noteRes.json().catch(() => null);
      toast.error(error?.error ?? "Failed to save note");
      setSaving(false);
      return;
    }

    const note = await noteRes.json();
    if (note.linkWarning) {
      toast.warning(note.linkWarning);
    }
    setSaving(false);
    setExtracting(true);
    streamRef.current = "";

    // Stream extraction
    const extractRes = await fetch("/api/notes/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: note.id }),
    });

    if (!extractRes.ok || !extractRes.body) {
      toast.error("Extraction failed");
      setExtracting(false);
      return;
    }

    const reader = extractRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamRef.current += decoder.decode(value, { stream: true });
    }

    setExtracting(false);

    const parsed = safeParseJson(streamRef.current, null);
    if (!parsed) {
      toast.error("Failed to parse extraction — try again");
      return;
    }

    // Fetch the saved extraction from DB
    const notesRes = await fetch("/api/notes");
    const notes = await notesRes.json();
    const savedNote = notes.find((n: { id: string }) => n.id === note.id);
    const extraction = savedNote?.extractions?.[0];

    if (extraction) {
      onExtractionComplete({
        id: extraction.id,
        noteId: note.id,
        decisions: JSON.parse(extraction.decisionsJson),
        openQuestions: JSON.parse(extraction.openQuestionsJson),
        actionItems: JSON.parse(extraction.actionItemsJson),
        followUps: JSON.parse(extraction.followUpsJson),
        insights: JSON.parse(extraction.insightsJson),
        calendarUpdates: JSON.parse(extraction.calendarUpdatesJson),
        contextUpdates: JSON.parse(extraction.contextUpdatesJson),
        taskSuggestions: JSON.parse(extraction.taskSuggestionsJson),
        approvedAt: extraction.approvedAt ? new Date(extraction.approvedAt) : null,
        appliedAt: extraction.appliedAt ? new Date(extraction.appliedAt) : null,
        extractedAt: new Date(extraction.extractedAt),
      });
      setRawContent("");
      setTitle("");
      setSource("manual");
      setGranolaId(null);
      setSelectedEventId("");
      toast.success("Extraction complete");
    }
  }

  async function loadGranola() {
    setGranolaLoading(true);
    try {
      const res = await fetch("/api/notes/granola");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load Granola meetings");
      } else {
        setGranolaList(data);
        setGranolaOpen(true);
      }
    } catch {
      toast.error("Failed to reach Granola — check your token");
    } finally {
      setGranolaLoading(false);
    }
  }

  async function importGranolaMeeting(meeting: { id: string; title: string; date: string }) {
    toast.info("Fetching note content…");
    let notes = "";
    try {
      const fullRes = await fetch(`/api/notes/granola?noteId=${encodeURIComponent(meeting.id)}`);
      if (fullRes.ok) {
        const full = await fullRes.json();
        notes = full.notes ?? "";
      }
    } catch {
      // fall through with empty notes
    }

    setRawContent(notes);
    setTitle(meeting.title);
    setSource("granola");
    setGranolaId(meeting.id);
    setMeetingDate(toDateInputValue(meeting.date));
    setSelectedEventId("");
    setGranolaOpen(false);
    toast.success("Meeting imported — review the calendar link, then extract");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Paste Meeting Notes</h3>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={loadGranola}
          disabled={granolaLoading}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {granolaLoading ? "Loading…" : "Import from Granola"}
        </Button>
      </div>

      {granolaOpen && granolaList.length > 0 && (
        <div className="border rounded-lg bg-white divide-y max-h-48 overflow-y-auto">
          {granolaList.map((m) => (
            <button
              key={m.id}
              onClick={() => importGranolaMeeting(m)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.date}</p>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Input
          placeholder="Meeting title (optional)"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSelectedEventId("");
          }}
          className="text-sm"
        />
        <div className="grid gap-2 rounded-lg border border-border bg-paper-2 p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
              Link to meeting
            </p>
          </div>
          <Input
            type="date"
            value={meetingDate}
            onChange={(event) => {
              setMeetingDate(event.target.value);
              setSelectedEventId("");
            }}
            className="text-sm"
          />
          <select
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            className="w-full rounded-md border border-border bg-paper px-3 py-2 text-sm"
          >
            <option value="">
              {eventsLoading ? "Loading meetings..." : "No linked meeting"}
            </option>
            {nearbyEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {formatEventOption(event)}
              </option>
            ))}
          </select>
          {selectedEvent && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link2 className="h-3 w-3" />
              Will link to {selectedEvent.title}
            </p>
          )}
        </div>
        <Textarea
          placeholder="Paste your meeting notes here…"
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          rows={10}
          className="text-sm resize-none font-mono"
        />
      </div>

      <Button
        className="w-full"
        onClick={handleExtract}
        disabled={saving || extracting || !rawContent.trim()}
      >
        <Sparkles className="h-4 w-4 mr-1.5" />
        {saving ? "Saving…" : extracting ? "Extracting insights…" : "Extract Insights"}
      </Button>
    </div>
  );
}

function toDateInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDayRange(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

function formatEventOption(event: ScoredEvent) {
  const start = new Date(event.startTime);
  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} · ${event.title}`;
}
