"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { MetricCard, SectionHead } from "@/components/editorial/SectionHead";
import { AddTaskInput } from "@/components/tasks/AddTaskInput";
import { TaskItem } from "@/components/tasks/TaskItem";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "@/types/task";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()),
  });

  const prioritizeMutation = useMutation({
    mutationFn: () =>
      fetch("/api/tasks/prioritize", { method: "POST" }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Re-prioritized ${data.updated} tasks`);
    },
    onError: () => toast.error("Failed to prioritize"),
  });

  const openTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const pa = a.manualPriority ?? a.aiPriority ?? 999;
      const pb = b.manualPriority ?? b.aiPriority ?? 999;
      return pa - pb;
    });

  const filteredTasks = openTasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "only-you") return task.priorityLabel === "critical";
    if (filter === "today") {
      return task.dueDate
        ? new Date(task.dueDate).toDateString() === new Date().toDateString()
        : false;
    }
    return task.priorityLabel === filter;
  });

  const completedTasks = tasks
    .filter((t) => t.status === "done")
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.updatedAt).getTime() -
        new Date(a.completedAt ?? a.updatedAt).getTime()
    )
    .slice(0, 20);

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  const dueThisWeek = openTasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due >= now && due <= weekEnd;
  }).length;

  return (
    <>
      <Header
        title="Tasks"
        eyebrow="Execution · Prioritized by contribution"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => prioritizeMutation.mutate()}
            disabled={prioritizeMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {prioritizeMutation.isPending ? "Prioritizing…" : "Re-prioritize"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="view space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Open" value={openTasks.length} />
            <MetricCard label="Critical" value={openTasks.filter((t) => t.priorityLabel === "critical").length} tone="bad" />
            <MetricCard label="Due this week" value={dueThisWeek} />
            <MetricCard label="Closed (7d)" value={completedTasks.length} tone="good" />
          </div>

          <div className="flex border-b border-border">
            {[
              ["all", "All"],
              ["only-you", "Only you"],
              ["high", "High"],
              ["medium", "Medium"],
              ["low", "Low"],
              ["today", "Today"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  filter === key
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-paper">
            <div className="border-b border-border bg-paper-2 p-3">
              <AddTaskInput
                onAdded={() => {
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                }}
              />
            </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No open tasks. Add one above or import from meeting notes.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onUpdated={() =>
                    queryClient.invalidateQueries({ queryKey: ["tasks"] })
                  }
                />
              ))}
            </div>
          )}
          </div>

          {completedTasks.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showCompleted ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Completed ({completedTasks.length})
              </button>

              {showCompleted && (
                <div className="space-y-1 opacity-60">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onUpdated={() =>
                        queryClient.invalidateQueries({ queryKey: ["tasks"] })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <section>
            <SectionHead eyebrow="rationale" title="Why these priorities" />
            <div className="editorial-card-flat">
              <p className="m-0 text-sm leading-relaxed text-ink-2">
                <span className="font-serif italic">Critical</span> marks the few tasks where delay changes the outcome.
                <span className="font-serif italic"> Only you</span> narrows that list further to work that depends on your judgment, relationships, or writing.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
