"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, Check, Loader2, PanelRightClose, PanelRightOpen, Send, Sparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn, safeParseJson } from "@/lib/utils";
import type { AgentAction, AgentResponse } from "@/types/agent";

export function AgentPanel() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 xl:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" className="h-11 w-11 rounded-full shadow-lg">
              <Sparkles className="h-4 w-4" />
              <span className="sr-only">Open agent</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="flex w-full max-w-md flex-col p-0">
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle className="font-serif text-xl font-normal">Drucker Agent</SheetTitle>
            </SheetHeader>
            <PanelContent />
          </SheetContent>
        </Sheet>
      </div>

      <aside
        className={cn(
          "hidden h-screen shrink-0 border-l border-border bg-paper-2 transition-[width] duration-200 xl:flex",
          desktopCollapsed ? "w-14" : "w-[360px]"
        )}
      >
        {desktopCollapsed ? (
          <CollapsedRail onExpand={() => setDesktopCollapsed(false)} />
        ) : (
          <PanelContent onCollapse={() => setDesktopCollapsed(true)} />
        )}
      </aside>
    </>
  );
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center border-l-0 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={onExpand}
      >
        <PanelRightOpen className="h-4 w-4" />
        <span className="sr-only">Expand agent</span>
      </Button>
      <div className="mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="mt-3 [writing-mode:vertical-rl] font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
        Agent
      </div>
    </div>
  );
}

function PanelContent({ onCollapse }: { onCollapse?: () => void }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data, isLoading, isError } = useQuery<AgentResponse>({
    queryKey: ["agent"],
    queryFn: async () => {
      const response = await fetch("/api/agent");
      if (!response.ok) throw new Error("Failed to load agent");
      return response.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: data?.thread?.id,
          message: content,
        }),
      });
      if (!response.ok) throw new Error("Agent request failed");
      return response.json() as Promise<AgentResponse>;
    },
    onSuccess: (nextData) => {
      queryClient.setQueryData(["agent"], nextData);
      setMessage("");
    },
    onError: () => toast.error("The agent could not complete that request."),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const response = await fetch(`/api/agent/actions/${id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Could not ${action} action`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent"] });
    },
    onError: () => toast.error("Could not update that action."),
  });

  const pendingActions = useMemo(
    () => (data?.actions ?? []).filter((action) => action.status === "pending"),
    [data?.actions]
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="font-serif text-lg leading-none">Agent</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Acts with approval
              </p>
            </div>
          </div>
          {onCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCollapse}
            >
              <PanelRightClose className="h-4 w-4" />
              <span className="sr-only">Collapse agent</span>
            </Button>
          )}
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div className="border-b border-border bg-warn-soft/40 px-3 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            Needs approval
          </p>
          <div className="space-y-2">
            {pendingActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                disabled={actionMutation.isPending}
                onApprove={() => actionMutation.mutate({ id: action.id, action: "approve" })}
                onReject={() => actionMutation.mutate({ id: action.id, action: "reject" })}
              />
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agent...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-ink">
            The agent could not load. Make sure the agent tables have been added to Supabase.
          </div>
        )}
        {!isLoading && !isError && (data?.messages.length ?? 0) === 0 && (
          <div className="rounded-xl border border-border bg-paper px-4 py-5">
            <p className="font-serif text-xl">What should I take care of?</p>
            <p className="mt-2 text-sm leading-6 text-ink-3">
              Try asking it to create a task, add a collaborator, remember context, or draft a
              calendar block for approval.
            </p>
          </div>
        )}
        {(data?.messages ?? []).map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-xl px-3 py-2 text-sm leading-6",
              item.role === "user"
                ? "ml-8 bg-accent text-accent-foreground"
                : "mr-8 border border-border bg-paper text-ink"
            )}
          >
            {item.content}
          </div>
        ))}
        {sendMutation.isPending && (
          <div className="mr-8 flex items-center gap-2 rounded-xl border border-border bg-paper px-3 py-2 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking and checking tools...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border bg-paper px-3 py-3">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              handleSubmit(event);
            }
          }}
          placeholder="Ask the agent to act..."
          className="min-h-20 resize-none border-border bg-paper-2 text-sm shadow-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            Cmd Enter
          </p>
          <Button size="sm" type="submit" disabled={!message.trim() || sendMutation.isPending}>
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function ActionCard({
  action,
  disabled,
  onApprove,
  onReject,
}: {
  action: AgentAction;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const payload = safeParseJson<Record<string, unknown>>(action.payloadJson, {});
  const title = getPayloadTitle(action.type, payload);

  return (
    <div className="rounded-lg border border-border bg-paper p-3 text-sm">
      <p className="font-medium text-ink">{humanizeTool(action.type)}</p>
      <p className="mt-1 text-ink-3">{title}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onApprove} disabled={disabled}>
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} disabled={disabled}>
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}

function humanizeTool(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getPayloadTitle(type: string, payload: Record<string, unknown>) {
  if (typeof payload.title === "string") return payload.title;
  if (typeof payload.name === "string") return payload.name;
  if (Array.isArray(payload.signalIds)) return `${payload.signalIds.length} email signals`;
  if (Array.isArray(payload.threadIds)) return `${payload.threadIds.length} email threads`;
  if (type.includes("email")) return `Up to ${String(payload.limit ?? "selected")} email items`;
  if (type === "schedule_focus_block") return "Calendar focus block";
  return humanizeTool(type);
}
