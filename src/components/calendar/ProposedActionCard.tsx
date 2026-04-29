import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProposedAction, CalendarActionType } from "@/types/calendar";

interface Props {
  action: ProposedAction;
  onApprove: () => void;
  loading?: boolean;
}

const ACTION_STYLES: Record<CalendarActionType, string> = {
  keep: "bg-green-50 text-green-700 border-green-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  move: "bg-blue-50 text-blue-700 border-blue-200",
  shorten: "bg-amber-50 text-amber-700 border-amber-200",
  add_prep_time: "bg-violet-50 text-violet-700 border-violet-200",
  add_follow_up: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ask_for_agenda: "bg-orange-50 text-orange-700 border-orange-200",
  ask_to_reschedule: "bg-yellow-50 text-yellow-700 border-yellow-200",
  convert_to_async: "bg-gray-50 text-gray-700 border-gray-200",
};

const ACTION_LABELS: Record<CalendarActionType, string> = {
  keep: "Keep",
  delete: "Delete",
  move: "Move",
  shorten: "Shorten",
  add_prep_time: "Add prep",
  add_follow_up: "Add follow-up",
  ask_for_agenda: "Ask for agenda",
  ask_to_reschedule: "Reschedule",
  convert_to_async: "Go async",
};

export function ProposedActionCard({ action, onApprove, loading }: Props) {
  if (action.type === "keep") return null;

  return (
    <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className={cn("text-xs", ACTION_STYLES[action.type])}
          >
            {ACTION_LABELS[action.type]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {Math.round(action.confidence * 100)}% confidence
          </span>
        </div>
        <p className="text-xs text-foreground">{action.description}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs shrink-0 text-green-700 border-green-200 hover:bg-green-50"
        onClick={onApprove}
        disabled={loading}
      >
        <Check className="h-3 w-3 mr-1" />
        Apply
      </Button>
    </div>
  );
}
