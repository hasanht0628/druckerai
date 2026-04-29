"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/editorial/SectionHead";
import { CollaboratorCard } from "@/components/collaborators/CollaboratorCard";
import { CollaboratorForm } from "@/components/collaborators/CollaboratorForm";
import { isOverdue } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Collaborator } from "@/types/collaborator";

export default function CollaboratorsPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);

  const { data: collaborators = [], isLoading } = useQuery<Collaborator[]>({
    queryKey: ["collaborators"],
    queryFn: () => fetch("/api/collaborators").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/collaborators/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
      toast.success("Collaborator removed");
    },
  });

  function onSaved() {
    setSheetOpen(false);
    queryClient.invalidateQueries({ queryKey: ["collaborators"] });
  }

  const overdue = collaborators.filter((c) => c.nextFollowUpDate && isOverdue(c.nextFollowUpDate)).length;
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const thisWeek = collaborators.filter((c) => {
    if (!c.nextFollowUpDate) return false;
    const date = new Date(c.nextFollowUpDate);
    return date <= weekEnd;
  }).length;

  return (
    <>
      <Header
        title="Collaborators"
        eyebrow="Relationships · People who shape the work"
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="view grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 rounded-lg bg-paper-2 animate-pulse" />
            ))}
          </div>
        ) : collaborators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">No collaborators yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add advisors, teammates, investors, customers, and partners.
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add first collaborator
            </Button>
          </div>
        ) : (
          <div className="view space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Total" value={collaborators.length} />
              <MetricCard label="Overdue" value={overdue} tone={overdue ? "bad" : "good"} />
              <MetricCard label="This week" value={thisWeek} tone="accent" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {collaborators.map((c) => (
                <CollaboratorCard
                  key={c.id}
                  collaborator={c}
                  onEdit={() => {
                    setEditing(c);
                    setSheetOpen(true);
                  }}
                  onDelete={() => deleteMutation.mutate(c.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit Collaborator" : "Add Collaborator"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <CollaboratorForm
              initial={editing}
              onSaved={onSaved}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
