"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronUp, FileText, ClipboardType, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KeyDocument } from "@/types/document";

interface Props {
  document: KeyDocument;
  onDelete: () => void;
  onToggleActive: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  paste: { label: "Pasted", icon: <ClipboardType className="h-3 w-3" /> },
  upload: { label: "Uploaded", icon: <FileText className="h-3 w-3" /> },
  google_drive: { label: "Google Drive", icon: <HardDrive className="h-3 w-3" /> },
};

export function DocumentCard({ document, onDelete, onToggleActive }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const source = SOURCE_LABELS[document.source] ?? SOURCE_LABELS.paste;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents?id=${document.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete();
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id, isActive: !document.isActive }),
      });
      if (!res.ok) throw new Error();
      onToggleActive();
      toast.success(document.isActive ? "Document deactivated" : "Document activated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className={`rounded-lg border border-border bg-paper p-4 transition-opacity ${document.isActive ? "" : "opacity-50"}`}>
      <div className="mb-4 grid aspect-[4/3] place-items-center rounded-md border border-dashed border-[var(--rule-2)] bg-paper-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {document.title.split(/\s+/)[0] ?? "Doc"}
      </div>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{document.title}</p>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              {source.icon}
              {source.label}
            </Badge>
            {!document.isActive && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Added {new Date(document.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>

          <div className="mt-2">
            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {document.summary}
            </p>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Show less" : "Show full summary"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
              document.isActive ? "bg-zinc-900" : "bg-zinc-200"
            }`}
            title={document.isActive ? "Deactivate (exclude from AI)" : "Activate (include in AI)"}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                document.isActive ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
