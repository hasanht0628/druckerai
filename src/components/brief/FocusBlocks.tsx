"use client";

import { useState } from "react";
import { Brain, CalendarPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/editorial/SectionHead";
import { formatTime } from "@/lib/utils";
import type { FocusBlock } from "@/types/brief";

interface Props {
  blocks: FocusBlock[];
}

export function FocusBlocks({ blocks }: Props) {
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<Set<number>>(new Set());

  if (!blocks.length) return null;

  async function addToCalendar(block: FocusBlock, index: number) {
    setLoading((s) => new Set(s).add(index));
    try {
      const res = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Focus: ${block.suggestedTask}`,
          startTime: block.startTime,
          endTime: block.endTime,
          description: block.rationale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAdded((s) => new Set(s).add(index));
      toast.success("Focus block added to calendar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to calendar");
    } finally {
      setLoading((s) => { const n = new Set(s); n.delete(index); return n; });
    }
  }

  return (
    <section>
      <SectionHead eyebrow="03" title="Where to put deep work" />
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-border border-l-[3px] border-l-accent bg-gradient-to-b from-paper to-paper-2 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent shrink-0" />
                <p className="text-sm font-medium">{b.suggestedTask}</p>
                <span className="font-mono text-xs text-accent">
                  {formatTime(b.startTime)}–{formatTime(b.endTime)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{b.rationale}</p>
            </div>
            <Button
              size="sm"
              variant={added.has(i) ? "secondary" : "outline"}
              className="h-7 text-xs shrink-0 self-start"
              disabled={added.has(i) || loading.has(i)}
              onClick={() => addToCalendar(b, i)}
            >
              {added.has(i) ? (
                <><Check className="h-3 w-3 mr-1" />Added</>
              ) : loading.has(i) ? (
                "Adding…"
              ) : (
                <><CalendarPlus className="h-3 w-3 mr-1" />Add</>
              )}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
