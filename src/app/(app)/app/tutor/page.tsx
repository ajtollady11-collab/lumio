import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorPage, TutorSkeleton } from "@/components/tutor/tutor-page";

export const metadata: Metadata = { title: "My Tutor" };

export default function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[]; topic?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<TutorSkeleton />}>
      <New searchParams={searchParams} />
    </Suspense>
  );
}

async function New({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[]; topic?: string | string[] }>;
}) {
  const { subject, topic } = await searchParams;
  return (
    <TutorPage
      conversationId={null}
      subjectSlug={typeof subject === "string" ? subject : undefined}
      // Prefills the topic box only; it's validated like any typed topic when sent.
      initialTopic={typeof topic === "string" ? topic.slice(0, 120) : undefined}
    />
  );
}
