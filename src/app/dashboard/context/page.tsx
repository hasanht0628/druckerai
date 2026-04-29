"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/editorial/SectionHead";
import { ContextItemCard } from "@/components/context/ContextItemCard";
import { ContextItemForm } from "@/components/context/ContextItemForm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ContextItem, ContextCategory } from "@/types/context";

const CATEGORIES: { key: ContextCategory; label: string; description: string }[] = [
  { key: "project", label: "Active Projects", description: "What you're currently building or leading" },
  { key: "goal", label: "Goals", description: "What you're trying to achieve this quarter" },
  { key: "deadline", label: "Deadlines", description: "Hard dates that constrain your schedule" },
  { key: "priority", label: "Priorities", description: "What matters most right now" },
  { key: "constraint", label: "Constraints", description: "Limitations on your time or resources" },
  { key: "preference", label: "Preferences", description: "How you work best" },
];

export default function ContextPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ContextItem | null>(null);

  const { data: items = [], isLoading } = useQuery<ContextItem[]>({
    queryKey: ["context"],
    queryFn: () => fetch("/api/context?active=false").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/context?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["context"] });
      toast.success("Item deleted");
    },
  });

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(item: ContextItem) {
    setEditing(item);
    setSheetOpen(true);
  }

  function onSaved() {
    setSheetOpen(false);
    queryClient.invalidateQueries({ queryKey: ["context"] });
  }

  const byCategory = (cat: ContextCategory) =>
    items.filter((i) => i.category === cat);

  return (
    <>
      <Header
        title="Context"
        eyebrow="Inputs · What Drucker should know"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Item
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="view space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-paper-2 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="view view-narrow space-y-8">
            <p className="precept">
              Drucker is only as useful as the commitments, constraints, and principles it can see.
            </p>
            {CATEGORIES.map(({ key, label, description }, index) => {
              const categoryItems = byCategory(key);
              return (
                <section key={key}>
                  <div className="mb-3">
                    <SectionHead
                      eyebrow={String(index + 1).padStart(2, "0")}
                      title={label}
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditing({ category: key } as ContextItem);
                            setSheetOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      }
                    />
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>

                  {categoryItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-1">
                      Nothing added yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {categoryItems.map((item) => (
                        <ContextItemCard
                          key={item.id}
                          item={item}
                          onEdit={() => openEdit(item)}
                          onDelete={() => deleteMutation.mutate(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing?.id ? "Edit Item" : "Add Context Item"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ContextItemForm
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
