"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { SectionHead, Tag } from "@/components/editorial/SectionHead";
import { NotesPasteArea } from "@/components/notes/NotesPasteArea";
import { ExtractionPreview } from "@/components/notes/ExtractionPreview";
import { NoteCard } from "@/components/notes/NoteCard";
import type { NoteExtraction } from "@/types/notes";

interface NoteWithExtraction {
  id: string;
  title?: string | null;
  rawContent: string;
  source: string;
  meetingDate?: string | null;
  googleEventId?: string | null;
  calendarEventTitle?: string | null;
  calendarEventStartTime?: string | null;
  createdAt: string;
  extractions: Array<{
    id: string;
    decisionsJson: string;
    openQuestionsJson: string;
    actionItemsJson: string;
    followUpsJson: string;
    insightsJson: string;
    calendarUpdatesJson: string;
    contextUpdatesJson: string;
    taskSuggestionsJson: string;
    approvedAt: string | null;
    appliedAt: string | null;
    extractedAt: string;
  }>;
}

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [activeExtraction, setActiveExtraction] = useState<NoteExtraction | null>(null);

  const { data: notes = [] } = useQuery<NoteWithExtraction[]>({
    queryKey: ["notes"],
    queryFn: () => fetch("/api/notes").then((r) => r.json()),
  });

  function onExtractionComplete(extraction: NoteExtraction) {
    setActiveExtraction(extraction);
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  }

  return (
    <>
      <Header
        title="Meeting Notes"
        eyebrow="Inputs · Decisions, questions, and tasks"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="view grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Left: Input */}
          <div className="space-y-4">
            <NotesPasteArea onExtractionComplete={onExtractionComplete} />

            {notes.length > 0 && (
              <section>
                <SectionHead eyebrow="01" title="Past notes" />
                <div className="space-y-2">
                  {notes.slice(0, 10).map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onViewExtraction={() => {
                        if (note.extractions[0]) {
                          const e = note.extractions[0];
                          setActiveExtraction({
                            id: e.id,
                            noteId: note.id,
                            decisions: JSON.parse(e.decisionsJson),
                            openQuestions: JSON.parse(e.openQuestionsJson),
                            actionItems: JSON.parse(e.actionItemsJson),
                            followUps: JSON.parse(e.followUpsJson),
                            insights: JSON.parse(e.insightsJson),
                            calendarUpdates: JSON.parse(e.calendarUpdatesJson),
                            contextUpdates: JSON.parse(e.contextUpdatesJson),
                            taskSuggestions: JSON.parse(e.taskSuggestionsJson),
                            approvedAt: e.approvedAt ? new Date(e.approvedAt) : null,
                            appliedAt: e.appliedAt ? new Date(e.appliedAt) : null,
                            extractedAt: new Date(e.extractedAt),
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: Extraction preview */}
          <div>
            {activeExtraction ? (
              <ExtractionPreview
                extraction={activeExtraction}
                onApplied={() => {
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["context"] });
                }}
              />
            ) : (
              <div className="editorial-card flex h-64 flex-col items-center justify-center border-dashed text-center">
                <Tag kind="accent">Extraction</Tag>
                <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                  Decisions, open questions, suggested tasks, and strategic insights will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
