import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PARENT_NAV, allItems, findBySlug } from "@/components/shell/navigation";
import { SectionInDevelopment } from "@/components/shell/section-in-development";

/* Holding route for parent areas that haven't shipped (see app/[section]). */

const BUILT = new Set(["settings"]);

export function generateStaticParams() {
  return allItems(PARENT_NAV)
    .filter((i) => i.href !== PARENT_NAV.home)
    .map((i) => i.href.slice(PARENT_NAV.home.length + 1))
    .filter((slug) => !BUILT.has(slug))
    .map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/parent/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findBySlug(PARENT_NAV, section)?.label ?? "Not found" };
}

export default async function ParentSectionPage({ params }: PageProps<"/parent/[section]">) {
  const { section } = await params;
  const item = findBySlug(PARENT_NAV, section);
  if (!item) notFound();
  return <SectionInDevelopment item={item} homeHref={PARENT_NAV.home} />;
}
