"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ChevronLeft, ChevronRight, MapPin, Scan } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard, Tag } from "@/components/editorial/SectionHead";
import { formatTime } from "@/lib/utils";
import type { ScoredEvent } from "@/types/calendar";

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_HEIGHT = 72;
type ReviewFilter = "all" | "keep" | "challenge" | "eliminate" | "flagged" | "unscored";

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const calendarQueryKey = useMemo(
    () => ["calendar-events", weekStart.toISOString()] as const,
    [weekStart]
  );

  const { data: events = [], isLoading, error } = useQuery<ScoredEvent[]>({
    queryKey: calendarQueryKey,
    queryFn: () =>
      fetch(
        `/api/calendar/events?start=${encodeURIComponent(weekStart.toISOString())}&end=${encodeURIComponent(weekEnd.toISOString())}`
      ).then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e));
        return r.json();
      }),
    retry: false,
  });
  const selectedEvent = events.find((event) => event.id === selectedId) ?? events[0];

  const scoreMutation = useMutation({
    mutationFn: () =>
      fetch("/api/calendar/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: events.map((event) => event.id),
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success(`Scored ${data.scored} events`);
    },
    onError: () => toast.error("Scoring failed"),
  });

  const notConnected =
    (error as { error?: string })?.error === "Google Calendar not connected";
  const scoredEvents = events.filter((event) => event.overall !== undefined);
  const averageScore = scoredEvents.length
    ? Math.round(scoredEvents.reduce((sum, event) => sum + (event.overall ?? 0), 0) / scoredEvents.length)
    : "—";
  const challengeEvents = events.filter((event) => event.primaryConcern === "challenge");
  const eliminateEvents = events.filter((event) => event.primaryConcern === "eliminate");
  const controlledMinutes = [...challengeEvents, ...eliminateEvents]
    .reduce((sum, event) => sum + (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000, 0);
  const filteredEvents = useMemo(
    () => filterEvents(events, reviewFilter),
    [events, reviewFilter]
  );
  const weekDays = useMemo(() => makeDays(weekStart), [weekStart]);
  const weekLabel = formatWeekRange(weekStart, weekEnd);

  useEffect(() => {
    if (events.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !events.some((event) => event.id === selectedId)) {
      setSelectedId(events[0].id);
    }
  }, [events, selectedId]);

  return (
    <>
      <Header
        title="Calendar"
        eyebrow="Time · Challenge every event"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart(getWeekStart(new Date()))}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => scoreMutation.mutate()}
              disabled={scoreMutation.isPending || notConnected || events.length === 0}
            >
              <Scan className="h-4 w-4 mr-1.5" />
              {scoreMutation.isPending ? "Analyzing Week..." : "Analyze Week"}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {notConnected ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-medium text-sm">Google Calendar not connected</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Run the setup script to connect your calendar:
            </p>
            <code className="mt-3 text-xs bg-gray-100 px-3 py-2 rounded-md block">
              node scripts/setup-google-auth.js
            </code>
          </div>
        ) : isLoading ? (
          <div className="view space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="view space-y-6">
            <WeekHeading weekLabel={weekLabel} />
            <p className="text-sm text-muted-foreground text-center py-20">
              No events this week.
            </p>
          </div>
        ) : (
          <div className="view space-y-6">
            <WeekHeading weekLabel={weekLabel} />
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Week score" value={averageScore} tone={typeof averageScore === "number" && averageScore < 50 ? "bad" : "accent"} helper={`${scoredEvents.length} events scored`} />
              <MetricCard label="Challenge" value={challengeEvents.length} tone="warn" helper={`${Math.round(controlledMinutes / 60)}h questionable`} />
              <MetricCard label="Eliminate" value={eliminateEvents.length} tone="bad" helper="Consider removing" />
            </div>

            <ReviewFilters
              value={reviewFilter}
              events={events}
              onChange={setReviewFilter}
            />

            <CalendarGrid
              events={filteredEvents}
              weekDays={weekDays}
              selectedId={selectedEvent?.id ?? null}
              onSelect={setSelectedId}
            />
          </div>
        )}
      </div>
    </>
  );
}

function CalendarGrid({
  events,
  weekDays,
  selectedId,
  onSelect,
}: {
  events: ScoredEvent[];
  weekDays: Date[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const gridTemplateColumns = `64px repeat(${weekDays.length}, minmax(0, 1fr))`;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-paper">
      <div className="border-b border-border bg-paper-2 px-4 py-3">
        <p className="section-eyebrow">Week view</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze the week to mark meetings to keep, challenge, or eliminate.
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          <div className="grid border-b border-border" style={{ gridTemplateColumns }}>
            <div />
            {weekDays.map((day) => (
              <div key={day.toDateString()} className="border-l border-border px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="font-serif text-2xl leading-none text-ink">
                  {day.getDate()}
                </p>
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{ height: totalHeight, gridTemplateColumns }}
          >
            <div className="relative border-r border-border bg-paper-2">
              {hours.slice(0, -1).map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 -translate-y-2 px-2 text-right font-mono text-[10px] text-ink-4"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {weekDays.map((day) => (
              <div key={day.toDateString()} className="relative border-l border-border">
                {hours.slice(0, -1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-border/70"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}
                {events
                  .filter((event) => isSameDay(event.startTime, day))
                  .map((event) => (
                    <CalendarBlock
                      key={event.id}
                      event={event}
                      selected={event.id === selectedId}
                      onSelect={() => onSelect(event.id)}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewFilters({
  value,
  events,
  onChange,
}: {
  value: ReviewFilter;
  events: ScoredEvent[];
  onChange: (value: ReviewFilter) => void;
}) {
  const options: Array<{ key: ReviewFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: events.length },
    { key: "keep", label: "Keep", count: events.filter((event) => event.primaryConcern === "keep").length },
    { key: "challenge", label: "Challenge", count: events.filter((event) => event.primaryConcern === "challenge").length },
    { key: "eliminate", label: "Eliminate", count: events.filter((event) => event.primaryConcern === "eliminate").length },
    { key: "flagged", label: "Flagged", count: events.filter((event) => (event.flags ?? []).length > 0).length },
    { key: "unscored", label: "Unscored", count: events.filter((event) => event.overall === undefined).length },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.key
              ? "border-accent bg-[var(--burnt-soft)] text-foreground"
              : "border-border bg-paper text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
          <span className="ml-1 font-mono text-[10px] text-ink-4">
            {option.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function CalendarBlock({
  event,
  selected,
  onSelect,
}: {
  event: ScoredEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const { top, height } = getEventPosition(event);
  const concern = event.primaryConcern;
  const flags = (event.flags ?? []).slice(0, 2);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute left-1.5 right-1.5 overflow-hidden rounded-md border px-2 py-1.5 text-left transition-colors ${getEventBlockClass(event, selected)}`}
      style={{ top, height }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            concern === "keep"
              ? "bg-good"
              : concern === "challenge"
              ? "bg-warn"
              : concern === "eliminate"
              ? "bg-bad"
              : "bg-ink-4"
          }`}
        />
        <p className="min-w-0 flex-1 whitespace-normal break-words text-xs font-medium leading-tight">
          {event.title}
        </p>
        {typeof event.overall === "number" ? (
          <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] ${getScoreClass(event.overall)}`}>
            {Math.round(event.overall)}
          </span>
        ) : (
          <span className="ml-auto shrink-0 rounded-full bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-4">
            unscored
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span>{formatTime(event.startTime)}</span>
        {event.location && <MapPin className="h-3 w-3" />}
      </div>
      {flags.length > 0 && height >= 58 && (
        <div className="mt-1 flex gap-1 overflow-hidden">
          {flags.map((flag) => (
            <span
              key={flag}
              className="truncate rounded-full bg-paper px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3"
            >
              {formatFlag(flag)}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function WeekHeading({ weekLabel }: { weekLabel: string }) {
  return (
    <section>
      <p className="section-eyebrow">Visible week</p>
      <h2 className="mt-1 font-serif text-3xl leading-tight">{weekLabel}</h2>
    </section>
  );
}

function makeDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatWeekRange(start: Date, end: Date) {
  const inclusiveEnd = addDays(end, -1);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = inclusiveEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

function isSameDay(date: string, day: Date) {
  return new Date(date).toDateString() === day.toDateString();
}

function filterEvents(events: ScoredEvent[], filter: ReviewFilter) {
  switch (filter) {
    case "keep":
    case "challenge":
    case "eliminate":
      return events.filter((event) => event.primaryConcern === filter);
    case "flagged":
      return events.filter((event) => (event.flags ?? []).length > 0);
    case "unscored":
      return events.filter((event) => event.overall === undefined);
    case "all":
    default:
      return events;
  }
}

function getEventBlockClass(event: ScoredEvent, selected: boolean) {
  if (selected) return "border-accent bg-[var(--burnt-soft)]";
  if (event.primaryConcern === "keep") return "border-good/40 bg-good-soft/70 hover:bg-good-soft";
  if (event.primaryConcern === "challenge") return "border-warn/50 bg-warn-soft/80 hover:bg-warn-soft";
  if (event.primaryConcern === "eliminate") return "border-bad/50 bg-bad-soft/80 hover:bg-bad-soft";
  return "border-border bg-paper hover:bg-paper-2";
}

function getScoreClass(score: number) {
  if (score >= 70) return "bg-good-soft text-good";
  if (score >= 40) return "bg-warn-soft text-warn";
  return "bg-bad-soft text-bad";
}

function formatFlag(flag: NonNullable<ScoredEvent["flags"]>[number]) {
  const labels: Record<string, string> = {
    no_agenda: "no agenda",
    could_be_async: "async",
    conflicts_with_deadline: "conflict",
    key_relationship: "key rel",
  };
  return labels[flag] ?? flag.replace(/_/g, " ");
}

function getEventPosition(event: ScoredEvent) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const startOffset = (start.getHours() + start.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT;
  const duration = Math.max(30, (end.getTime() - start.getTime()) / 60000);
  const height = Math.max(64, (duration / 60) * HOUR_HEIGHT);
  const maxTop = (END_HOUR - START_HOUR) * HOUR_HEIGHT - height;

  return {
    top: Math.max(0, Math.min(startOffset, maxTop)),
    height,
  };
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

