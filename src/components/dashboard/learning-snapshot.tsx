import { Brain } from "lucide-react";
import Link from "next/link";
import { MASTERY_LEVELS, type MasteryLevel } from "@/lib/learning/levels";
import { areasToImprove, recentImprovements, strengths, type LearningProfileRow } from "@/lib/learning/profile";
import { Panel } from "./panel";

const lvl = (n: number) => MASTERY_LEVELS[Math.min(6, Math.max(1, n)) as MasteryLevel].short;

/** Home-page summary of My Learning Profile. Lists, not scores. */
export function LearningSnapshot({
  learning,
  subjectName,
  today,
}: {
  learning: LearningProfileRow;
  subjectName: (id: string | null) => string | null;
  today: string;
}) {
  // One line per topic: a weakness and a misconception on the same topic read as a duplicate here.
  const improve = areasToImprove(learning)
    .filter(
      (i, n, all) =>
        all.findIndex((j) => j.subjectId === i.subjectId && j.topic.toLowerCase() === i.topic.toLowerCase()) === n,
    )
    .slice(0, 3);
  const strong = strengths(learning).slice(0, 3);
  const up = recentImprovements(learning, new Date(`${today}T12:00:00Z`), 30).slice(0, 3);
  const empty = learning.mastery.length === 0 && learning.insights.length === 0;

  return (
    <Panel
      id="learning-profile"
      title="My Learning Profile"
      icon={Brain}
      action={{ label: empty ? "How it works" : "Open profile", href: "/app/progress" }}
    >
      {empty ? (
        <p className="text-sm leading-relaxed text-fg-muted">
          As you answer your tutor’s questions, Lumio tracks each topic — what you’ve got, what needs work and what
          helps you learn. Nothing is recorded until you’ve actually answered something.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          <Column title="Areas to improve" empty="None recorded">
            {improve.map((i) => (
              <Item key={i.id} topic={i.topic} meta={subjectName(i.subjectId)} />
            ))}
          </Column>
          <Column title="Strengths" empty="None yet">
            {strong.map((i) => (
              <Item key={i.id} topic={i.topic} meta={subjectName(i.subjectId)} />
            ))}
          </Column>
          <Column title="Improved this month" empty="No level changes yet">
            {up.map((c) => (
              <Item
                key={`${c.subjectId}:${c.topicKey}`}
                topic={c.topic}
                meta={`${lvl(c.fromLevel)} → ${lvl(c.toLevel)}`}
              />
            ))}
          </Column>
        </div>
      )}
    </Panel>
  );
}

function Column({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <h3 className="text-[0.75rem] font-medium tracking-wide text-fg-subtle uppercase">{title}</h3>
      {children.length === 0 ? (
        <p className="mt-2 text-sm text-fg-subtle">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">{children}</ul>
      )}
    </div>
  );
}

function Item({ topic, meta }: { topic: string; meta: string | null }) {
  return (
    <li className="text-sm">
      <Link href="/app/progress#mastery" className="block truncate font-medium hover:text-blue-300">
        {topic}
      </Link>
      {meta && <span className="block truncate text-[0.8125rem] text-fg-subtle">{meta}</span>}
    </li>
  );
}
