"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHead } from "@/components/editorial/SectionHead";
import { PriorityList } from "@/components/brief/PriorityList";
import { MeetingReview } from "@/components/brief/MeetingReview";
import { FocusBlocks } from "@/components/brief/FocusBlocks";
import { OverdueFollowUps } from "@/components/brief/OverdueFollowUps";
import type { DailyBrief } from "@/types/brief";
import type { Task } from "@/types/task";

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: brief, isLoading } = useQuery<DailyBrief>({
    queryKey: ["brief"],
    queryFn: () => fetch("/api/brief").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()),
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      fetch("/api/brief", { method: "POST" }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(["brief"], data);
      toast.success("Brief regenerated");
    },
    onError: () => toast.error("Failed to regenerate brief"),
  });

  return (
    <>
      <Header
        title="Daily Brief"
        eyebrow="Today · What only you can do"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`}
            />
            Regenerate
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="view view-narrow">
            <BriefSkeleton />
          </div>
        ) : !brief || Object.keys(brief).length === 0 ? (
          <EmptyBrief onGenerate={() => regenerateMutation.mutate()} />
        ) : (
          <div className="view view-narrow space-y-8">
            <section className="mb-12">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {new Date(brief.date ?? Date.now()).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h2 className="text-display mb-4 max-w-[22ch]">
                Three things matter today.
              </h2>
              <p className="precept">
                Of these, only a few need you. Protect the decisions, the quiet work,
                and the relationships that will not wait.
              </p>
            </section>
            <PriorityList priorities={brief.topPriorities ?? []} tasks={tasks} onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })} />
            <MeetingReview
              protect={brief.meetingsToProtect ?? []}
              challenge={brief.meetingsToChallenge ?? []}
            />
            <FocusBlocks blocks={brief.focusBlocks ?? []} />
            <OverdueFollowUps followUps={brief.overdueFollowUps ?? []} />
            {(brief.decisionsAwaiting ?? []).length > 0 && (
              <section>
                <SectionHead eyebrow="04" title="Decisions awaiting you" />
                <div className="overflow-hidden rounded-lg border border-border bg-paper">
                  {brief.decisionsAwaiting.map((d, i) => (
                    <div key={i} className="border-b border-border px-4 py-3 last:border-b-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium">{d.description}</p>
                        {d.urgency === "high" && (
                          <span className="tag tag-bad">High urgency</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{d.context}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="rounded-lg bg-[var(--burnt-soft)] px-5 py-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--burnt-ink)]">
                End-of-day prompt
              </p>
              <p className="font-serif text-lg italic text-ink-2">
                What did I decide today that no one else could decide for me?
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyBrief({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <h3 className="font-medium text-sm">No brief yet</h3>
      <p className="text-xs text-muted-foreground mt-2">
        Add some context, tasks, or collaborators, then generate your daily brief.
      </p>
      <Button size="sm" className="mt-4" onClick={onGenerate}>
        Generate Brief
      </Button>
    </div>
  );
}
