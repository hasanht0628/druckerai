"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventScoreBar } from "./EventScoreBar";
import { ProposedActionCard } from "./ProposedActionCard";
import { cn, formatTime } from "@/lib/utils";
import type { ScoredEvent, ProposedAction, TaskSuggestion } from "@/types/calendar";

interface Props {
  event: ScoredEvent;
  onActionApplied: () => void;
}

const CONCERN_STYLES = {
  keep: "border-l-green-400",
  challenge: "border-l-amber-400",
  eliminate: "border-l-red-400",
};

export function EventCard({ event, onActionApplied }: Props) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: (action: ProposedAction) =>
      fetch("/api/calendar/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, action }),
      }),
    onSuccess: () => {
      toast.success("Action applied to Google Calendar");
      onActionApplied();
    },
    onError: () => toast.error("Failed to apply action"),
  });

  const addTaskMutation = useMutation({
    mutationFn: (suggestion: TaskSuggestion) =>
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          dueDate: suggestion.dueDate,
          source: "calendar",
        }),
      }),
    onSuccess: () => {
      toast.success("Task added");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // Background re-prioritize
      fetch("/api/tasks/prioritize", { method: "POST" }).catch(() => {});
    },
  });

  const durationMins = Math.round(
    (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) /
      60000
  );

  const hasScore = event.overall !== undefined;
  const scoreColor =
    !hasScore
      ? ""
      : event.overall! >= 70
      ? "text-green-600"
      : event.overall! >= 40
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div
      className={cn(
        "bg-white border rounded-lg border-l-4 overflow-hidden",
        event.primaryConcern
          ? CONCERN_STYLES[event.primaryConcern]
          : "border-l-gray-200"
      )}
    >
      {/* Header */}
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {event.title}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(event.startTime)} · {durationMins}m
              </span>
              {event.attendees.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.attendees.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasScore && (
              <span className={cn("text-sm font-semibold tabular-nums", scoreColor)}>
                {Math.round(event.overall!)}
              </span>
            )}
            {event.primaryConcern && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  event.primaryConcern === "keep"
                    ? "text-green-700 border-green-200"
                    : event.primaryConcern === "challenge"
                    ? "text-amber-700 border-amber-200"
                    : "text-red-700 border-red-200"
                )}
              >
                {event.primaryConcern}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {hasScore && event.scores && (
          <div className="mt-2">
            <EventScoreBar scores={event.scores} />
          </div>
        )}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {event.rationale && (
            <p className="text-xs text-muted-foreground">{event.rationale}</p>
          )}

          {event.flags && event.flags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {event.flags.map((flag) => (
                <Badge key={flag} variant="secondary" className="text-xs">
                  {flag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}

          {event.taskSuggestions && event.taskSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Suggested tasks
              </p>
              {event.taskSuggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-md px-3 py-2"
                >
                  <span>{suggestion.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2 shrink-0"
                    onClick={() => addTaskMutation.mutate(suggestion)}
                    disabled={addTaskMutation.isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}

          {event.proposedActions && event.proposedActions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Proposed actions
              </p>
              {event.proposedActions.map((action, i) => (
                <ProposedActionCard
                  key={i}
                  action={action}
                  onApprove={() => applyMutation.mutate(action)}
                  loading={applyMutation.isPending}
                />
              ))}
            </div>
          )}

          {!hasScore && (
            <p className="text-xs text-muted-foreground italic">
              Click "Analyze Events" to score this event.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
