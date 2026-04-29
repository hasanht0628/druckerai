"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/editorial/SectionHead";
import type { CoachMessage, CoachThreadResponse } from "@/types/coach";

export default function CoachPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<CoachMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const { data, isLoading, error } = useQuery<CoachThreadResponse>({
    queryKey: ["coach"],
    queryFn: async () => {
      const res = await fetch("/api/coach");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load coach");
      setThreadId(payload.thread?.id ?? null);
      setLocalMessages(payload.messages ?? []);
      return payload;
    },
  });

  const messages = localMessages.length > 0 ? localMessages : data?.messages ?? [];

  async function sendMessage() {
    const content = draft.trim();
    if (!content || isSending) return;

    const userMessage: CoachMessage = {
      id: `local-user-${Date.now()}`,
      threadId: threadId ?? "pending",
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMessage: CoachMessage = {
      id: assistantId,
      threadId: threadId ?? "pending",
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setDraft("");
    setIsSending(true);
    setStreamingId(assistantId);
    setLocalMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message: content }),
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Coach failed to respond");
      }

      const responseThreadId = res.headers.get("X-Coach-Thread-Id");
      if (responseThreadId) setThreadId(responseThreadId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setLocalMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk }
              : message
          )
        );
      }

      queryClient.invalidateQueries({ queryKey: ["coach"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coach failed to respond");
      setLocalMessages((current) =>
        current.filter((message) => message.id !== assistantId)
      );
    } finally {
      setIsSending(false);
      setStreamingId(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <Header title="Coach" eyebrow="Coaching · Always on" />
      <main className="flex-1 overflow-y-auto">
        <div className="view view-narrow space-y-8">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Tag kind="accent">Always-on coach</Tag>
              <span className="text-xs text-muted-foreground">Reads context, week, and decisions</span>
            </div>
            <h2 className="font-serif text-3xl font-normal tracking-[-0.01em]">
              A second mind for the calls only you can make.
            </h2>
          </section>

          <div className="flex min-h-[280px] flex-col gap-4">
            {isLoading ? (
              <div className="editorial-card border-dashed">
                <p className="text-sm text-muted-foreground">Loading coach history...</p>
              </div>
            ) : error ? (
              <div className="editorial-card border-dashed">
                <p className="text-sm text-bad">Coach history could not be loaded.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="editorial-card border-dashed">
                <p className="text-sm text-muted-foreground">
                  Ask Drucker about a decision, relationship, priority, or use of time.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    message.role === "assistant"
                      ? "self-start border border-border bg-paper-2"
                      : "self-end bg-primary text-primary-foreground"
                  }`}
                >
                  {message.role === "assistant" && (
                    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.2em] text-accent">
                      Drucker
                    </span>
                  )}
                  {message.content || (message.id === streamingId ? "Thinking..." : "")}
                </div>
              ))
            )}
          </div>

          <div className="editorial-card p-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What are you thinking about?"
              className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              disabled={isSending}
            />
            <div className="mt-2 flex items-center gap-3 border-t border-border pt-3">
              <Tag>new thread</Tag>
              <span className="flex-1" />
              <span className="rounded border border-border bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘ ↵</span>
              <Button size="sm" disabled={!draft.trim() || isSending} onClick={sendMessage}>
                <Send className="h-3 w-3" />
                {isSending ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
