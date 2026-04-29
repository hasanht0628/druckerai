import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { OverdueFollowUp } from "@/types/brief";

interface Props {
  followUps: OverdueFollowUp[];
}

export function OverdueFollowUps({ followUps }: Props) {
  if (!followUps.length) return null;

  return (
    <section>
      <SectionHead eyebrow="05" title="Relationships gone quiet" />
      <div className="overflow-hidden rounded-lg border border-border bg-paper">
        {followUps.map((f, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-3 text-xs font-semibold text-paper">
              {f.collaboratorName.split(" ").map((name) => name[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{f.collaboratorName}</p>
              <p className="text-xs text-muted-foreground">
                {f.suggestedTopic}
              </p>
            </div>
            <span className={`font-mono text-xs ${f.daysSinceContact > 20 ? "text-bad" : "text-warn"}`}>
              {f.daysSinceContact > 0 ? `${f.daysSinceContact}d quiet` : "no log"}
            </span>
            <Button variant="outline" size="sm">Reach out</Button>
          </div>
        ))}
      </div>
    </section>
  );
}
