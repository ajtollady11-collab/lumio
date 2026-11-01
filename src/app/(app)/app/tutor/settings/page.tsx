import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/feedback/skeletons";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { PageHeader } from "@/components/shell/page-header";
import { MemoryPanel, TutorSettingsForm } from "@/components/tutor/tutor-settings-form";
import { requireViewer } from "@/lib/auth/session";
import { getTutorMemory, getTutorPageData } from "@/server/tutor/data";

export const metadata: Metadata = { title: "Customise your tutor" };

export default function TutorSettingsPage() {
  return (
    <div className="space-y-8">
      <Link href="/app/tutor" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Back to your tutor
      </Link>
      <PageHeader
        title="Customise your tutor"
        description="These settings change how your tutor actually explains things — not just its name."
      />
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireViewer("/app/tutor/settings");
  const [data, memory] = await Promise.all([getTutorPageData(null), getTutorMemory()]);
  if (!data || data === "not_found" || !memory) return <ServiceUnavailable />;
  return (
    <div className="space-y-10">
      <TutorSettingsForm initial={data.tutor} customised={data.tutorCustomised} />
      <MemoryPanel items={memory} tutorName={data.tutor.name} />
    </div>
  );
}
