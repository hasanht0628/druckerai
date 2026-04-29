"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatDate } from "@/lib/utils";
import type { Task, PriorityLabel } from "@/types/task";

interface Props {
  task: Task;
  onUpdated: () => void;
}

const PRIORITY_STYLES: Record<PriorityLabel, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-gray-50 text-gray-600 border-gray-200",
};

export function TaskItem({ task, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const isDone = task.status === "done";

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) =>
      fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => onUpdated(),
    onError: () => toast.error("Failed to update task"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: () => onUpdated(),
    onError: () => toast.error("Failed to delete task"),
  });

  function toggleDone() {
    updateMutation.mutate({ status: isDone ? "open" : "done" });
  }

  function saveTitle() {
    if (title.trim() && title.trim() !== task.title) {
      updateMutation.mutate({ title: title.trim() });
    }
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 bg-paper px-4 py-3 transition-colors hover:bg-paper-2",
        isDone && "opacity-50"
      )}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={toggleDone}
        className="shrink-0"
      />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            className="w-full text-sm bg-transparent outline-none border-b border-primary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitle(task.title);
                setEditing(false);
              }
            }}
            autoFocus
          />
        ) : (
          <span
            className={cn(
              "text-sm cursor-pointer",
              isDone && "line-through text-muted-foreground"
            )}
            onClick={() => !isDone && setEditing(true)}
          >
            {task.title}
          </span>
        )}

        {task.dueDate && !isDone && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Due {formatDate(task.dueDate)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {task.priorityLabel && !isDone && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize cursor-default",
                    PRIORITY_STYLES[task.priorityLabel as PriorityLabel]
                  )}
                >
                  {task.priorityLabel}
                </Badge>
              </TooltipTrigger>
              {task.priorityReason && (
                <TooltipContent className="max-w-xs text-xs">
                  {task.priorityReason}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        <button
          onClick={() => deleteMutation.mutate()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
