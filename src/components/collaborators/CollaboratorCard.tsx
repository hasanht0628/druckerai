"use client";

import { Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, isOverdue } from "@/lib/utils";
import type { Collaborator } from "@/types/collaborator";

interface Props {
  collaborator: Collaborator;
  onEdit: () => void;
  onDelete: () => void;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  advisor: "bg-purple-50 text-purple-700 border-purple-200",
  teammate: "bg-blue-50 text-blue-700 border-blue-200",
  investor: "bg-green-50 text-green-700 border-green-200",
  customer: "bg-orange-50 text-orange-700 border-orange-200",
  partner: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export function CollaboratorCard({ collaborator, onEdit, onDelete }: Props) {
  const needsFollowUp =
    collaborator.nextFollowUpDate &&
    isOverdue(collaborator.nextFollowUpDate);

  return (
    <div className="group relative rounded-lg border border-border bg-paper p-4 transition-colors hover:bg-paper-2">
      {needsFollowUp && (
        <div className="absolute top-3 right-3">
          <AlertCircle className="h-4 w-4 text-amber-500" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 pr-6">
          <p className="font-medium text-sm text-foreground truncate">
            {collaborator.name}
          </p>
          {collaborator.role && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {collaborator.role}
            </p>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={cn(
            "text-xs capitalize",
            RELATIONSHIP_COLORS[collaborator.relationshipType]
          )}
        >
          {collaborator.relationshipType}
        </Badge>
        <div className="ml-auto flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-3 rounded-full",
                i < collaborator.importanceLevel
                  ? "bg-foreground"
                  : "bg-paper-3"
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <div>
          <p className="metric-label">Last</p>
          <p className="mt-1 text-xs text-ink-2">
            {collaborator.lastContactDate
              ? new Date(collaborator.lastContactDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "None"}
          </p>
        </div>
        <div>
          <p className="metric-label">Next</p>
          <p className="mt-1 text-xs text-ink-2">
            {collaborator.nextFollowUpDate
              ? new Date(collaborator.nextFollowUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—"}
          </p>
        </div>
        <div>
          <p className="metric-label">Cadence</p>
          <p className="mt-1 text-xs capitalize text-ink-2">
            {collaborator.preferredCadence ?? "—"}
          </p>
        </div>
      </div>

      {needsFollowUp && (
        <p className="text-xs text-amber-600 font-medium mt-1">
          Follow-up overdue
        </p>
      )}

      <div className="flex gap-1 mt-3 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
