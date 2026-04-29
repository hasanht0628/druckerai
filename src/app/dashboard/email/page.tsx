"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, RefreshCw, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHead, Tag } from "@/components/editorial/SectionHead";
import { formatDate } from "@/lib/utils";

interface EmailSignalRow {
  id: string;
  type: string;
  title: string;
  rationale?: string | null;
  dueDate?: string | null;
  confidence?: number | null;
  EmailThreadCache?: {
    subject: string;
    summary?: string | null;
    lastMessageAt: string;
  } | null;
}

export default function EmailPage() {
  const queryClient = useQueryClient();

  const { data: signals = [], isLoading: signalsLoading } = useQuery<EmailSignalRow[]>({
    queryKey: ["email-signals"],
    queryFn: () => fetch("/api/email/signals").then((res) => res.json()),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults: 15 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Email sync failed");
      return data as { synced: number; analyzed: number; filtered: number };
    },
    onSuccess: (data) => {
      toast.success(`Analyzed ${data.analyzed} Primary threads · filtered ${data.filtered} low-signal threads`);
      queryClient.invalidateQueries({ queryKey: ["email-signals"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Email sync failed");
    },
  });

  const patchSignalMutation = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: "accepted" | "dismissed" }) => {
      const res = await fetch("/api/email/signals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, state }),
      });
      if (!res.ok) throw new Error("Failed to update signal");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-signals"] }),
    onError: () => toast.error("Failed to update email signal"),
  });

  async function acceptAsTask(signal: EmailSignalRow) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: signal.title,
        description: signal.rationale ?? signal.EmailThreadCache?.summary ?? null,
        dueDate: signal.dueDate ?? null,
        source: "email",
      }),
    });

    if (!res.ok) {
      toast.error("Failed to create task");
      return;
    }

    patchSignalMutation.mutate({ id: signal.id, state: "accepted" });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Task created from email");
  }

  return (
    <>
      <Header
        title="Email"
        eyebrow="Inputs · Inbox intelligence"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing..." : "Sync Gmail"}
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto">
        <div className="view space-y-8">
          <p className="precept">
            Drucker reads recent Primary inbox threads and skips Updates, promotions, newsletters, and automated noise before extraction.
          </p>

          <section>
            <SectionHead eyebrow="01" title="Review email signals" />
            {signalsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <div className="editorial-card flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No open email signals. Sync Gmail to extract tasks, deadlines, and follow-ups.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-paper">
                {signals.map((signal) => (
                  <div key={signal.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Tag kind={signal.type === "deadline" ? "warn" : signal.type === "decision" ? "accent" : "good"}>
                        {signal.type.replace("_", " ")}
                      </Tag>
                      {signal.dueDate && (
                        <span className="font-mono text-xs text-muted-foreground">
                          due {formatDate(signal.dueDate)}
                        </span>
                      )}
                      {typeof signal.confidence === "number" && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {Math.round(signal.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium">{signal.title}</h3>
                    {signal.rationale && (
                      <p className="mt-1 text-xs text-muted-foreground">{signal.rationale}</p>
                    )}
                    {signal.EmailThreadCache && (
                      <p className="mt-2 text-xs text-ink-3">
                        From: {signal.EmailThreadCache.subject}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => acceptAsTask(signal)}>
                        Add task
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => patchSignalMutation.mutate({ id: signal.id, state: "dismissed" })}
                      >
                        <X className="h-3 w-3" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </main>
    </>
  );
}
