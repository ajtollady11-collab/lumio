import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorPage, TutorSkeleton } from "@/components/tutor/tutor-page";

export const metadata: Metadata = { title: "My Tutor" };

export default function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<TutorSkeleton />}>
      <New searchParams={searchParams} />
    </Suspense>
  );
}

async function New({ searchParams }: { searchParams: Promise<{ subject?: string | string[] }> }) {
  const { subject } = await searchParams;
  return <TutorPage conversationId={null} subjectSlug={typeof subject === "string" ? subject : undefined} />;
}
