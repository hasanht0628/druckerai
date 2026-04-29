"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, daysUntil, isOverdue } from "@/lib/utils";
import type { ContextItem } from "@/types/context";

interface Props {
  item: ContextItem;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContextItemCard({ item, onEdit, onDelete }: Props) {
  const isDeadline = item.category === "deadline" && item.value;
  const days = isDeadline ? daysUntil(item.value!) : null;
  const overdue = isDeadline ? isOverdue(item.value!) : false;

  return (
    <div
      className={cn(
        "group flex items-start justify-between rounded-lg border border-border bg-paper px-4 py-3 transition-colors hover:bg-paper-2",
        !item.isActive && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{item.title}</span>
          {isDeadline && (
            <Badge
              variant={overdue ? "destructive" : days !== null && days <= 7 ? "default" : "secondary"}
              className="text-xs"
            >
              {overdue
                ? `${Math.abs(days!)}d overdue`
                : days === 0
                ? "Today"
                : `${days}d left`}
            </Badge>
          )}
          {item.category === "priority" && item.value && (
            <Badge variant="outline" className="text-xs capitalize">
              {item.value}
            </Badge>
          )}
          {!item.isActive && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
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
