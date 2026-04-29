"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { BriefPriority } from "@/types/brief";
import type { Task } from "@/types/task";

interface Props {
  priorities: BriefPriority[];
  tasks: Task[];
  onTaskUpdated: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-600 border-red-200 bg-red-50",
  high: "text-orange-600 border-orange-200 bg-orange-50",
  medium: "text-yellow-600 border-yellow-200 bg-yellow-50",
  low: "text-zinc-500 border-zinc-200 bg-zinc-50",
};

type CardState = "active" | "done" | "rejected";

export function PriorityList({ priorities, tasks, onTaskUpdated }: Props) {
  const [cardState, setCardState] = useState<Record<number, CardState>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  if (!priorities.length) return null;

  async function apiCall(rank: number, fn: () => Promise<void>) {
    setBusy((s) => ({ ...s, [rank]: true }));
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy((s) => ({ ...s, [rank]: false }));
    }
  }

  async function handleCheck(p: BriefPriority, rank: number) {
    await apiCall(rank, async () => {
      if (p.taskId) {
        const res = await fetch(`/api/tasks/${p.taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
        if (!res.ok) throw new Error("Failed to mark done");
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: p.title, description: p.rationale, status: "done", source: "brief" }),
        });
        if (!res.ok) throw new Error("Failed to create task");
      }
      setCardState((s) => ({ ...s, [rank]: "done" }));
      onTaskUpdated();
      toast.success("Marked done");
    });
  }

  async function handleAdd(p: BriefPriority, rank: number) {
    await apiCall(rank, async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: p.title, description: p.rationale, source: "brief" }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      onTaskUpdated();
      toast.success("Added to task list");
      // keep card visible but mark as synced — reload brief next time
    });
  }

  async function handleDeprioritize(taskId: string, rank: number) {
    await apiCall(rank, async () => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualPriority: 999 }),
      });
      if (!res.ok) throw new Error("Failed to deprioritize");
      onTaskUpdated();
      toast.success("Moved to bottom of list");
    });
  }

  async function handleDelete(taskId: string, rank: number) {
    await apiCall(rank, async () => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCardState((s) => ({ ...s, [rank]: "rejected" }));
      onTaskUpdated();
      toast.success("Task deleted");
    });
  }

  function handleReject(rank: number) {
    setCardState((s) => ({ ...s, [rank]: "rejected" }));
  }

  return (
    <section>
      <SectionHead eyebrow="01" title="Top priorities" />
      <div className="overflow-hidden rounded-lg border border-border bg-paper">
        {priorities.map((p) => {
          const rank = p.rank;
          const state = cardState[rank] ?? "active";
          const isBusy = busy[rank] ?? false;
          const task = p.taskId ? tasks.find((t) => t.id === p.taskId) : null;
          const inTaskList = Boolean(task);

          if (state === "rejected") return null;

          return (
            <div
              key={rank}
              className={`flex gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-paper-2 ${state === "done" ? "opacity-50" : ""}`}
            >
              {/* Rank badge */}
              <div className="mt-0.5 w-6 shrink-0 font-serif text-lg italic leading-none text-ink-3">
                {rank}.
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${state === "done" ? "line-through text-muted-foreground" : ""}`}>
                    {task?.title ?? p.title}
                  </p>
                  {task?.priorityLabel && (
                    <Badge variant="outline" className={`text-xs capitalize ${PRIORITY_COLORS[task.priorityLabel] ?? ""}`}>
                      {task.priorityLabel}
                    </Badge>
                  )}
                  {!inTaskList && (
                    <Badge variant="outline" className="tag tag-accent">
                      Only you
                    </Badge>
                  )}
                  {task?.dueDate && (
                    <span className="text-xs text-muted-foreground">
                      Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.rationale}</p>

                {/* Actions */}
                {state === "active" && (
                  <div className="flex items-center gap-2 mt-2">
                    {inTaskList ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          disabled={isBusy}
                          onClick={() => handleDeprioritize(task!.id, rank)}
                        >
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Deprioritize
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 text-red-600 hover:text-red-700 hover:border-red-300"
                          disabled={isBusy}
                          onClick={() => handleDelete(task!.id, rank)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          disabled={isBusy}
                          onClick={() => handleAdd(p, rank)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add to tasks
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-muted-foreground"
                          disabled={isBusy}
                          onClick={() => handleReject(rank)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Done checkbox */}
              <button
                onClick={() => state === "active" && handleCheck(p, rank)}
                disabled={isBusy || state === "done"}
                className={`h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  state === "done"
                    ? "bg-primary border-primary"
                    : "border-border hover:border-ring hover:bg-paper-2"
                }`}
                title={state === "done" ? "Done" : "Mark done"}
              >
                {state === "done" && <Check className="h-3 w-3 text-white" />}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
