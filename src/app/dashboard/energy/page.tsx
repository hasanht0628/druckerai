"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard, SectionHead, Tag } from "@/components/editorial/SectionHead";
import { cn, formatTime } from "@/lib/utils";
import type { ScoredEvent } from "@/types/calendar";

const DAYS_TO_ANALYZE = 14;
const START_HOUR = 7;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HourBucket {
  day: number;
  hour: number;
  meetingMinutes: number;
  energyScore: number;
  events: ScoredEvent[];
}

interface DateHourBucket extends HourBucket {
  date: Date;
  dateKey: string;
}

interface FocusWindow {
  date: Date;
  startHour: number;
  endHour: number;
  meetingMinutes: number;
  energyScore: number;
}

export default function EnergyPage() {
  const queryClient = useQueryClient();
  const { data: events = [], isLoading, error, isFetching } = useQuery<ScoredEvent[]>({
    queryKey: ["energy-map-events", DAYS_TO_ANALYZE],
    queryFn: () =>
      fetch(`/api/calendar/events?days=${DAYS_TO_ANALYZE}`).then((response) => {
        if (!response.ok) return response.json().then((body) => Promise.reject(body));
        return response.json();
      }),
    retry: false,
  });

  const energy = useMemo(() => buildEnergyMap(events), [events]);
  const notConnected =
    (error as { error?: string } | null)?.error === "Google Calendar not connected";

  return (
    <>
      <Header
        title="Energy Map"
        eyebrow="Coaching · Protect your best hours"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["energy-map-events"] })}
            disabled={isFetching}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto">
        {notConnected ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
            <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-sm font-medium">Google Calendar not connected</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Connect Google Calendar before Drucker can infer your energy map.
            </p>
          </div>
        ) : isLoading ? (
          <EnergySkeleton />
        ) : (
          <div className="view space-y-8">
            <section className="max-w-3xl">
              <p className="precept">
                The best calendar is built around when your judgment is sharpest, not when your inbox is loudest.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                This map uses the next {DAYS_TO_ANALYZE} days of meetings as a practical proxy:
                fewer meetings and fewer low-value interruptions mean more protected energy.
              </p>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Best focus hour"
                value={energy.bestHour ? formatHour(energy.bestHour.hour) : "—"}
                tone="good"
                helper={energy.bestHour ? `${DAY_LABELS[energy.bestHour.day]} average` : "No open windows found"}
              />
              <MetricCard
                label="Meeting load"
                value={`${Math.round(energy.totalMeetingMinutes / 60)}h`}
                tone={energy.totalMeetingMinutes > 24 * 60 ? "warn" : "accent"}
                helper={`${events.length} calendar events analyzed`}
              />
              <MetricCard
                label="Protected windows"
                value={energy.focusWindows.length}
                tone={energy.focusWindows.length > 2 ? "good" : "warn"}
                helper="Open blocks of 60+ minutes"
              />
            </div>

            <section>
              <SectionHead eyebrow="01" title="Energy by hour" />
              <EnergyGrid buckets={energy.buckets} />
            </section>

            <section>
              <SectionHead eyebrow="02" title="Best windows to protect" />
              {energy.focusWindows.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {energy.focusWindows.slice(0, 6).map((window) => (
                    <FocusWindowCard key={`${window.date.toISOString()}-${window.startHour}`} window={window} />
                  ))}
                </div>
              ) : (
                <div className="editorial-card border-dashed">
                  <p className="text-sm text-muted-foreground">
                    No 60-minute open windows found in working hours. Challenge or move low-value meetings before adding new commitments.
                  </p>
                </div>
              )}
            </section>

            <section>
              <SectionHead eyebrow="03" title="Heaviest drains" />
              <EnergyDrains events={energy.drainingEvents} />
            </section>
          </div>
        )}
      </main>
    </>
  );
}

function EnergyGrid({ buckets }: { buckets: HourBucket[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-paper">
      <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-border bg-paper-2">
        <div />
        {DAY_LABELS.map((day) => (
          <div key={day} className="px-2 py-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
            {day}
          </div>
        ))}
      </div>
      {HOURS.map((hour) => (
        <div key={hour} className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0">
          <div className="bg-paper-2 px-2 py-2 text-right font-mono text-[10px] text-ink-4">
            {formatHour(hour)}
          </div>
          {DAY_LABELS.map((_, day) => {
            const bucket = buckets.find((item) => item.day === day && item.hour === hour);
            const score = bucket?.energyScore ?? 100;
            return (
              <div key={`${day}-${hour}`} className="border-l border-border p-1">
                <div
                  className={cn(
                    "flex min-h-10 items-center justify-center rounded text-center font-mono text-[10px]",
                    getEnergyClass(score)
                  )}
                  title={`${Math.round(score)} energy · ${bucket?.meetingMinutes ?? 0} meeting minutes`}
                >
                  {Math.round(score)}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FocusWindowCard({ window }: { window: FocusWindow }) {
  return (
    <div className="editorial-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {window.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatHour(window.startHour)}-{formatHour(window.endHour)}
          </p>
        </div>
        <Tag kind={window.energyScore >= 80 ? "good" : "accent"}>
          {Math.round(window.energyScore)}
        </Tag>
      </div>
      <p className="text-xs text-muted-foreground">
        {window.meetingMinutes === 0
          ? "Completely open during working hours."
          : `${window.meetingMinutes} meeting minutes inside this block.`}
      </p>
    </div>
  );
}

function EnergyDrains({ events }: { events: ScoredEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="editorial-card border-dashed">
        <p className="text-sm text-muted-foreground">
          No obvious drains found. Score your calendar to improve this read.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-paper">
      {events.slice(0, 5).map((event) => (
        <div key={event.id} className="border-b border-border px-4 py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{event.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(event.startTime)} · {getDurationMinutes(event)}m
              </p>
            </div>
            {typeof event.overall === "number" && (
              <Tag kind={event.overall < 40 ? "bad" : "warn"}>{Math.round(event.overall)}</Tag>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EnergySkeleton() {
  return (
    <div className="view space-y-6">
      <Skeleton className="h-24 w-full max-w-3xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-[560px] w-full" />
    </div>
  );
}

function buildEnergyMap(events: ScoredEvent[]) {
  const dates = getVisibleDates(events);
  const dateBuckets: DateHourBucket[] = dates.flatMap((date) =>
    HOURS.map((hour) => {
      const overlappingEvents = events.filter((event) => eventOverlapsDateHour(event, date, hour));
      const meetingMinutes = overlappingEvents.reduce(
        (sum, event) => sum + getOverlapMinutes(event, hour),
        0
      );
      const lowValuePenalty = overlappingEvents.reduce((sum, event) => {
        if (event.primaryConcern === "eliminate") return sum + 25;
        if (event.primaryConcern === "challenge") return sum + 15;
        if (typeof event.overall === "number" && event.overall < 40) return sum + 15;
        return sum;
      }, 0);
      const energyScore = Math.max(0, 100 - meetingMinutes * 1.3 - lowValuePenalty);

      return {
        date,
        dateKey: getDateKey(date),
        day: date.getDay(),
        hour,
        meetingMinutes,
        energyScore,
        events: overlappingEvents,
      };
    })
  );
  const buckets = DAY_LABELS.flatMap((_, day) =>
    HOURS.map((hour) => {
      const matching = dateBuckets.filter((bucket) => bucket.day === day && bucket.hour === hour);
      const count = matching.length || 1;

      return {
        day,
        hour,
        meetingMinutes: matching.reduce((sum, bucket) => sum + bucket.meetingMinutes, 0) / count,
        energyScore: matching.reduce((sum, bucket) => sum + bucket.energyScore, 0) / count || 100,
        events: matching.flatMap((bucket) => bucket.events),
      };
    })
  );

  const totalMeetingMinutes = events.reduce((sum, event) => sum + getDurationMinutes(event), 0);
  const bestHour = [...buckets]
    .sort((a, b) => b.energyScore - a.energyScore || a.meetingMinutes - b.meetingMinutes)[0];

  return {
    buckets,
    totalMeetingMinutes,
    bestHour: bestHour?.energyScore > 0 ? bestHour : null,
    focusWindows: findFocusWindows(dateBuckets),
    drainingEvents: findDrainingEvents(events),
  };
}

function findFocusWindows(buckets: DateHourBucket[]) {
  const dates = [...new Map(buckets.map((bucket) => [bucket.dateKey, bucket.date])).values()];
  const windows: FocusWindow[] = [];

  for (const date of dates) {
    let startHour: number | null = null;
    let meetingMinutes = 0;
    let scoreTotal = 0;
    let bucketCount = 0;

    for (const hour of HOURS) {
      const bucket = buckets.find((item) => item.dateKey === getDateKey(date) && item.hour === hour);
      const isOpen = (bucket?.meetingMinutes ?? 0) <= 15;

      if (isOpen) {
        startHour ??= hour;
        meetingMinutes += bucket?.meetingMinutes ?? 0;
        scoreTotal += bucket?.energyScore ?? 100;
        bucketCount += 1;
        continue;
      }

      if (startHour !== null && hour - startHour >= 1) {
        windows.push(makeWindow(date, startHour, hour, meetingMinutes, scoreTotal, bucketCount));
      }
      startHour = null;
      meetingMinutes = 0;
      scoreTotal = 0;
      bucketCount = 0;
    }

    if (startHour !== null && END_HOUR - startHour >= 1) {
      windows.push(makeWindow(date, startHour, END_HOUR, meetingMinutes, scoreTotal, bucketCount));
    }
  }

  return windows
    .filter((window) => window.endHour - window.startHour >= 1)
    .sort((a, b) => b.energyScore - a.energyScore || a.date.getTime() - b.date.getTime());
}

function makeWindow(
  date: Date,
  startHour: number,
  endHour: number,
  meetingMinutes: number,
  scoreTotal: number,
  bucketCount: number
): FocusWindow {
  return {
    date,
    startHour,
    endHour,
    meetingMinutes,
    energyScore: bucketCount ? scoreTotal / bucketCount : 100,
  };
}

function findDrainingEvents(events: ScoredEvent[]) {
  return [...events]
    .filter((event) => getDurationMinutes(event) >= 30)
    .sort((a, b) => getDrainScore(b) - getDrainScore(a))
    .filter((event) => getDrainScore(event) > 0);
}

function getDrainScore(event: ScoredEvent) {
  const durationPenalty = getDurationMinutes(event) / 30;
  const concernPenalty =
    event.primaryConcern === "eliminate" ? 8 : event.primaryConcern === "challenge" ? 5 : 0;
  const scorePenalty = typeof event.overall === "number" ? Math.max(0, 60 - event.overall) / 10 : 0;
  return durationPenalty + concernPenalty + scorePenalty;
}

function getVisibleDates(events: ScoredEvent[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: DAYS_TO_ANALYZE }, (_, index) => addDays(today, index));
}

function eventOverlapsDateHour(event: ScoredEvent, date: Date, hour: number) {
  const start = new Date(event.startTime);
  return getDateKey(start) === getDateKey(date) && getOverlapMinutes(event, hour) > 0;
}

function getOverlapMinutes(event: ScoredEvent, hour: number) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const bucketStart = new Date(start);
  bucketStart.setHours(hour, 0, 0, 0);
  const bucketEnd = new Date(bucketStart);
  bucketEnd.setHours(hour + 1, 0, 0, 0);

  return Math.max(
    0,
    Math.round((Math.min(end.getTime(), bucketEnd.getTime()) - Math.max(start.getTime(), bucketStart.getTime())) / 60000)
  );
}

function getDurationMinutes(event: ScoredEvent) {
  return Math.max(
    0,
    Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function getEnergyClass(score: number) {
  if (score >= 80) return "bg-good-soft text-good";
  if (score >= 55) return "bg-[var(--burnt-soft)] text-[var(--burnt-ink)]";
  if (score >= 30) return "bg-warn-soft text-warn";
  return "bg-bad-soft text-bad";
}
