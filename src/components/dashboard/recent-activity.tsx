import {
  BookCheck,
  BookOpenCheck,
  History,
  Layers,
  ListChecks,
  MessageCircle,
  NotebookPen,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { formatMinutes } from "@/lib/dashboard/model";
import { ACTIVITY_LABELS, type ActivityType, type RecentActivity as Item } from "@/lib/dashboard/types";
import { EmptyState, Panel } from "./panel";

const ICONS: Record<ActivityType, LucideIcon> = {
  lesson: Presentation,
  tutor_session: MessageCircle,
  quiz: ListChecks,
  flashcards: Layers,
  exam_practice: BookOpenCheck,
  revision: BookCheck,
  notes: NotebookPen,
};

export function formatWhen(iso: string, timeZone: string, today: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(d); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(d);
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return `${new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(d)}, ${time}`;
}

function resultLabel(a: Item): string | null {
  if (a.scorePercent !== null) return `${Math.round(a.scorePercent)}%`;
  if (a.type === "lesson" || a.type === "quiz" || a.type === "exam_practice")
    return a.completed ? "Completed" : "Not finished";
  return null;
}

export function RecentActivity({
  items,
  subjectName,
  timeZone,
  today,
}: {
  items: Item[];
  subjectName: (id: string | null) => string | null;
  timeZone: string;
  today: string;
}) {
  return (
    <Panel id="recent" title="Recent activity" icon={History}>
      {items.length === 0 ? (
        <EmptyState icon={History} title="Nothing here yet">
          Lessons, quizzes, flashcard sessions and exam practice will appear here as you complete them — with the time,
          duration and result.
        </EmptyState>
      ) : (
        <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[1.1875rem] before:w-px before:bg-line">
          {items.map((a) => {
            const Icon = ICONS[a.type];
            const subject = subjectName(a.subjectId);
            const result = resultLabel(a);
            return (
              <li key={a.id} className="relative flex items-start gap-3.5 rounded-panel p-2">
                <span className="relative grid size-6 shrink-0 translate-x-[0.4375rem] place-items-center rounded-full bg-ink-800 ring-1 ring-line-strong">
                  <Icon className="size-3.5 text-blue-400" aria-hidden />
                </span>
                <div className="ml-1.5 min-w-0 flex-1">
                  <p className="text-[0.9375rem]">
                    <span className="font-medium">{ACTIVITY_LABELS[a.type]}</span>
                    {(a.title || subject) && (
                      <span className="text-fg-muted">
                        {" · "}
                        {[subject, a.title].filter(Boolean).join(": ")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] text-fg-subtle">
                    {formatWhen(a.occurredAt, timeZone, today)}
                    {a.activeSeconds >= 60 && ` · ${formatMinutes(Math.round(a.activeSeconds / 60))}`}
                  </p>
                </div>
                {result && (
                  <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-fg-muted tabular-nums ring-1 ring-line-strong ring-inset">
                    {result}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
