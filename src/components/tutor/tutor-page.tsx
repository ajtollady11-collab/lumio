import { notFound } from "next/navigation";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { requireViewer } from "@/lib/auth/session";
import { getTutorPageData } from "@/server/tutor/data";
import { TutorWorkspace } from "./tutor-workspace";

/** Shared server loader for /app/tutor and /app/tutor/c/[id]. */
export async function TutorPage({
  conversationId,
  subjectSlug,
}: {
  conversationId: string | null;
  subjectSlug?: string;
}) {
  await requireViewer(conversationId ? `/app/tutor/c/${conversationId}` : "/app/tutor");
  const data = await getTutorPageData(conversationId);
  if (data === "not_found") notFound();
  if (!data) return <ServiceUnavailable />;

  return (
    <TutorWorkspace
      key={conversationId ?? "new"}
      firstName={data.firstName}
      tutor={data.tutor}
      tutorCustomised={data.tutorCustomised}
      subjects={data.subjects}
      conversations={data.conversations}
      active={data.active}
      ready={data.readiness.ready}
      missing={data.readiness.ready ? [] : data.readiness.missing}
      consentRequired={data.consentRequired}
      remainingMessages={data.remainingMessages}
      initialSubjectId={subjectSlug ? (data.subjects.find((s) => s.slug === subjectSlug)?.id ?? null) : null}
    />
  );
}

export function TutorSkeleton() {
  return (
    <div role="status" aria-label="Loading your tutor" className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="hidden space-y-2 lg:block">
        <div className="skeleton h-9 rounded-control" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-12 rounded-control" />
        ))}
      </div>
      <div className="space-y-6">
        <div className="skeleton h-[4.25rem] rounded-stage" />
        <div className="skeleton mx-auto h-60 max-w-2xl rounded-stage" />
        <div className="skeleton h-28 rounded-stage" />
      </div>
    </div>
  );
}
