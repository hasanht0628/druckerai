import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EventScores } from "@/types/calendar";

const SEGMENTS = [
  { key: "importance" as keyof EventScores, label: "Importance", color: "bg-blue-400" },
  { key: "contribution" as keyof EventScores, label: "Contribution", color: "bg-indigo-400" },
  { key: "project_alignment" as keyof EventScores, label: "Alignment", color: "bg-violet-400" },
  { key: "relationship_value" as keyof EventScores, label: "Relationship", color: "bg-purple-400" },
  { key: "urgency" as keyof EventScores, label: "Urgency", color: "bg-pink-400" },
];

interface Props {
  scores: EventScores;
}

export function EventScoreBar({ scores }: Props) {
  return (
    <TooltipProvider>
      <div className="flex gap-0.5 h-1.5">
        {SEGMENTS.map(({ key, label, color }) => {
          const pct = (scores[key] / 10) * 100;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <div className="flex-1 bg-gray-100 rounded-full overflow-hidden cursor-default">
                  <div
                    className={`h-full ${color} rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {label}: {scores[key].toFixed(1)}/10
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
