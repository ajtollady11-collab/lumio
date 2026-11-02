import "server-only";
import { daysUntil } from "@/lib/onboarding/dates";
import { tutorContextSchema, tutorSettingsFrom } from "@/lib/tutor/context";
import type { TutorSettings } from "@/lib/tutor/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorReadiness, type AiReadiness } from "@/server/ai/config";
import { tryGetReferenceData } from "@/server/curriculum/reference";

/*
 * Data for the tutor pages. Three reads in parallel, all as the signed-in
 * student (RLS): the tutor context RPC (profile, subjects, settings, quota,
 * memory), the conversation list, and — if one is open — its latest messages.
 */

export const PAGE_SIZE = 40;

export type ConversationSummary = {
  id: string;
  title: string;
  subjectId: string | null;
  topic: string | null;
  lastMessageAt: string;
  messageCount: number;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "interrupted";
  createdAt: string;
};

export type TutorSubject = {
  id: string;
  slug: string;
  name: string;
  qualificationName: string;
  boardName: string | null;
  nextExamDays: number | null;
  confidence: string | null;
};

export type TutorMemoryItem = {
  kind: string;
  subjectName: string | null;
  topic: string;
  occurrences: number;
};

export type TutorPageData = {
  firstName: string | null;
  tutor: TutorSettings;
  tutorCustomised: boolean;
  subjects: TutorSubject[];
  conversations: ConversationSummary[];
  active: { conversation: ConversationSummary; messages: StoredMessage[]; hasEarlier: boolean } | null;
  readiness: AiReadiness;
  consentRequired: boolean;
  remainingMessages: number;
  memoryCount: number;
};

export async function getTutorPageData(conversationId: string | null): Promise<TutorPageData | null | "not_found"> {
  const db = await createSupabaseServerClient();
  const [ctx, list, msgs, reference] = await Promise.all([
    db.rpc("get_tutor_context", { p_conversation_id: conversationId ?? undefined, p_history: 0 }),
    db
      .from("tutor_conversations")
      .select("id, title, subject_id, topic, last_message_at, message_count")
      .order("last_message_at", { ascending: false })
      .limit(50),
    conversationId
      ? db
          .from("tutor_messages")
          .select("id, role, content, status, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE + 1)
      : Promise.resolve({ data: [], error: null }),
    tryGetReferenceData(),
  ]);
  if (ctx.error || list.error || msgs.error || !reference) return null;
  const parsed = tutorContextSchema.safeParse(ctx.data);
  if (!parsed.success) return null;
  const row = parsed.data;

  const conversations: ConversationSummary[] = (list.data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    subjectId: c.subject_id,
    topic: c.topic,
    lastMessageAt: c.last_message_at,
    messageCount: c.message_count,
  }));

  let active: TutorPageData["active"] = null;
  if (conversationId) {
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation || !row.conversation) return "not_found";
    const rows = msgs.data ?? [];
    active = {
      conversation,
      hasEarlier: rows.length > PAGE_SIZE,
      messages: rows
        .slice(0, PAGE_SIZE)
        .reverse()
        .map((m) => ({ id: m.id, role: m.role, content: m.content, status: m.status, createdAt: m.created_at })),
    };
  }

  const name = (list: { id: string; name: string }[], id: string | null) =>
    id ? (list.find((x) => x.id === id)?.name ?? null) : null;
  return {
    firstName: row.profile.firstName,
    tutor: tutorSettingsFrom(row),
    tutorCustomised: row.tutor !== null,
    subjects: row.subjects.flatMap((s) => {
      const subject = reference.subjects.find((x) => x.id === s.subjectId);
      if (!subject) return [];
      return [
        {
          id: s.subjectId,
          slug: subject.slug,
          name: subject.name,
          qualificationName: name(reference.qualifications, s.qualificationId) ?? "",
          boardName: name(reference.examBoards, s.examBoardId),
          nextExamDays: s.nextExam ? daysUntil(s.nextExam, row.today) : null,
          confidence: s.confidence,
        },
      ];
    }),
    conversations,
    active,
    readiness: tutorReadiness(),
    consentRequired: row.profile.parentalConsent === "pending" || row.profile.parentalConsent === "withdrawn",
    remainingMessages: Math.max(0, row.quota.allowance - row.quota.usedThisMonth),
    memoryCount: row.learning.insights.length + row.learning.topics.length,
  };
}
