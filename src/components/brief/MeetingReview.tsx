import { formatTime } from "@/lib/utils";
import { SectionHead, Tag } from "@/components/editorial/SectionHead";
import type { BriefMeeting } from "@/types/brief";

interface Props {
  protect: BriefMeeting[];
  challenge: BriefMeeting[];
}

export function MeetingReview({ protect, challenge }: Props) {
  if (!protect.length && !challenge.length) return null;

  return (
    <section>
      <SectionHead eyebrow="02" title="Today's calendar" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="editorial-card">
          <div className="mb-3 flex items-center gap-2">
            <Tag kind="good">Protect</Tag>
            <span className="text-xs text-muted-foreground">{protect.length} meetings</span>
          </div>
          <div className="space-y-3">
            {protect.map((m, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-3">
                  <span className="w-11 font-mono text-xs text-muted-foreground">{formatTime(m.startTime)}</span>
                  <p className="text-sm font-medium">{m.title}</p>
                </div>
                <p className="ml-14 text-xs text-muted-foreground">{m.reason}</p>
              </div>
            ))}
            {!protect.length && (
              <p className="text-xs text-muted-foreground">No meetings need explicit protection.</p>
            )}
          </div>
        </div>
        <div className="editorial-card">
          <div className="mb-3 flex items-center gap-2">
            <Tag kind="bad">Challenge</Tag>
            <span className="text-xs text-muted-foreground">{challenge.length} meetings</span>
          </div>
          <div className="space-y-3">
            {challenge.map((m, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-3">
                  <span className="w-11 font-mono text-xs text-muted-foreground">{formatTime(m.startTime)}</span>
                  <p className="text-sm font-medium">{m.title}</p>
                </div>
                <p className="ml-14 text-xs text-muted-foreground">{m.reason}</p>
                {m.suggestion && (
                  <p className="ml-14 mt-1 text-xs text-[var(--burnt-ink)]">
                    → {m.suggestion}
                  </p>
                )}
            </div>
            ))}
            {!challenge.length && (
              <p className="text-xs text-muted-foreground">No obvious calendar drag today.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
