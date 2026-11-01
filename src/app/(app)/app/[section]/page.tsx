import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STUDENT_NAV, allItems, findBySlug } from "@/components/shell/navigation";
import { SectionInDevelopment } from "@/components/shell/section-in-development";

/*
 * Holding route for student areas that haven't shipped. As each area is built
 * it gets its own folder (e.g. app/(app)/app/tutor/page.tsx), which takes
 * precedence over this dynamic segment.
 */

const BUILT = new Set(["settings"]);

export function generateStaticParams() {
  return allItems(STUDENT_NAV)
    .filter((i) => i.href !== STUDENT_NAV.home)
    .map((i) => i.href.slice(STUDENT_NAV.home.length + 1))
    .filter((slug) => !BUILT.has(slug))
    .map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/app/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findBySlug(STUDENT_NAV, section)?.label ?? "Not found" };
}

export default async function StudentSectionPage({ params }: PageProps<"/app/[section]">) {
  const { section } = await params;
  const item = findBySlug(STUDENT_NAV, section);
  if (!item) notFound();
  return <SectionInDevelopment item={item} homeHref={STUDENT_NAV.home} />;
}
