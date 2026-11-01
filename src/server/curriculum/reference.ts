import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import type { QualificationLevel } from "@/lib/onboarding/options";

export type Qualification = { id: string; slug: string; name: string; level: QualificationLevel };
export type ExamBoard = { id: string; slug: string; name: string };
export type Subject = { id: string; slug: string; name: string };

export type ReferenceData = {
  qualifications: Qualification[];
  examBoards: ExamBoard[];
  subjects: Subject[];
  /** qualification id → ids of boards that offer it */
  boardsByQualification: Record<string, string[]>;
};

/**
 * Curriculum vocabulary used by onboarding and settings. Public, rarely
 * changes, identical for every user — so it is cached for hours instead of
 * being queried on every page view (keeps us well inside free-plan limits).
 */
export async function getReferenceData(): Promise<ReferenceData> {
  "use cache";
  cacheLife("hours");
  cacheTag("curriculum-reference");

  const db = createSupabasePublicClient();
  const [q, b, s, qb] = await Promise.all([
    db.from("qualifications").select("id, slug, name, level").order("sort_order"),
    db.from("exam_boards").select("id, slug, name").order("sort_order"),
    db.from("subjects").select("id, slug, name").order("sort_order"),
    db.from("qualification_exam_boards").select("qualification_id, exam_board_id"),
  ]);
  const error = q.error ?? b.error ?? s.error ?? qb.error;
  if (error) throw new Error(`Reference data unavailable: ${error.message}`);

  const boardsByQualification: Record<string, string[]> = {};
  for (const row of qb.data ?? []) {
    (boardsByQualification[row.qualification_id] ??= []).push(row.exam_board_id);
  }
  // Keep the boards in their display order.
  const boardOrder = new Map((b.data ?? []).map((board, i) => [board.id, i]));
  for (const ids of Object.values(boardsByQualification)) {
    ids.sort((x, y) => (boardOrder.get(x) ?? 0) - (boardOrder.get(y) ?? 0));
  }

  return {
    qualifications: q.data ?? [],
    examBoards: b.data ?? [],
    subjects: s.data ?? [],
    boardsByQualification,
  };
}

/** Same data, but returns null instead of throwing when the database is unreachable. */
export async function tryGetReferenceData(): Promise<ReferenceData | null> {
  try {
    return await getReferenceData();
  } catch {
    return null;
  }
}
