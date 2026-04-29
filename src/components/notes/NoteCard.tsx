import { Calendar, CheckCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";

interface NoteCardProps {
  note: {
    id: string;
    title?: string | null;
    source: string;
    createdAt: string;
    calendarEventTitle?: string | null;
    calendarEventStartTime?: string | null;
    extractions: Array<{ id: string; appliedAt: string | null }>;
  };
  onViewExtraction: () => void;
}

export function NoteCard({ note, onViewExtraction }: NoteCardProps) {
  const hasExtraction = note.extractions.length > 0;
  const isApplied = hasExtraction && Boolean(note.extractions[0].appliedAt);

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border bg-white group">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {note.title ?? "Untitled note"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(note.createdAt)}
            {note.source === "granola" && " · Granola"}
          </p>
          {note.calendarEventTitle && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="truncate">
                {note.calendarEventStartTime
                  ? `${formatTime(note.calendarEventStartTime)} · `
                  : ""}
                {note.calendarEventTitle}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isApplied && (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        )}
        {note.calendarEventTitle && (
          <Badge variant="outline" className="text-[10px]">
            Linked
          </Badge>
        )}
        {hasExtraction && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onViewExtraction}
          >
            View
          </Button>
        )}
      </div>
    </div>
  );
}
