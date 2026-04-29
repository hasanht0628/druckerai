"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { NoteExtraction } from "@/types/notes";

interface Props {
  extraction: NoteExtraction;
  onApplied: () => void;
}

export function ExtractionPreview({ extraction, onApplied }: Props) {
  const [applyTasks, setApplyTasks] = useState(true);
  const [applyContext, setApplyContext] = useState(true);
  const [appliedAt, setAppliedAt] = useState<Date | null>(extraction.appliedAt ?? null);

  useEffect(() => {
    setAppliedAt(extraction.appliedAt ?? null);
  }, [extraction.appliedAt, extraction.id]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractionId: extraction.id,
          approvedCategories: {
            tasks: applyTasks,
            contextUpdates: applyContext,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to apply");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.applied?.join(", ") || "Nothing to apply — no tasks or context updates were suggested");
      setAppliedAt(data.appliedAt ? new Date(data.appliedAt) : new Date());
      onApplied();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to apply"),
  });

  const isApplied = Boolean(appliedAt);

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-medium">Extraction Results</h3>
        {isApplied && (
          <Badge variant="secondary" className="text-xs">Applied</Badge>
        )}
      </div>

      <div className="divide-y overflow-y-auto max-h-[calc(100vh-300px)]">
        <Section title="Decisions" items={extraction.decisions.map((d) => (
          <div key={d.text}>
            <p className="text-xs">{d.text}</p>
            {d.madeBy && <p className="text-xs text-muted-foreground">By: {d.madeBy}</p>}
            <Badge variant="outline" className={`text-xs mt-0.5 ${d.impact === "high" ? "text-red-600" : ""}`}>{d.impact}</Badge>
          </div>
        ))} />

        <Section title="Action Items" items={extraction.actionItems.map((a, i) => (
          <div key={i}>
            <p className="text-xs font-medium">{a.task}</p>
            {a.assignee && <p className="text-xs text-muted-foreground">→ {a.assignee}</p>}
            {a.dueDate && <p className="text-xs text-muted-foreground">Due: {a.dueDate}</p>}
          </div>
        ))} />

        <Section title="Open Questions" items={extraction.openQuestions.map((q, i) => (
          <p key={i} className="text-xs">{q}</p>
        ))} />

        <Section title="Follow-ups" items={extraction.followUps.map((f, i) => (
          <div key={i}>
            <p className="text-xs font-medium">{f.collaboratorName}</p>
            <p className="text-xs text-muted-foreground">{f.topic}</p>
          </div>
        ))} />

        <Section title="Strategic Insights" items={extraction.insights.map((s, i) => (
          <p key={i} className="text-xs">{s}</p>
        ))} />

        <Section title="Context Updates" items={extraction.contextUpdates.map((u, i) => (
          <div key={i}>
            <p className="text-xs font-medium capitalize">{u.action} {u.category}: {u.title}</p>
            {u.description && <p className="text-xs text-muted-foreground">{u.description}</p>}
          </div>
        ))} />
      </div>

      {!isApplied && (
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={applyTasks}
                onChange={(e) => setApplyTasks(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Create tasks from action items
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={applyContext}
                onChange={(e) => setApplyContext(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Apply context updates
            </label>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending || (!applyTasks && !applyContext)}
          >
            <Check className="h-4 w-4 mr-1.5" />
            {applyMutation.isPending ? "Applying…" : "Apply Selected"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: React.ReactNode[] }) {
  if (!items.length) return null;
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="space-y-2">{items}</div>
    </div>
  );
}
