import "server-only";
import { tutorContextSchema } from "@/lib/tutor/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import type { TutorStore } from "./turn";

/**
 * Supabase-backed TutorStore for one signed-in student.
 *
 * `studentId` comes from the verified session (getClaims), never from the
 * request body. Student-side calls run with the student's own session, so
 * RLS applies; server-side calls use the secret key and always pin
 * `student_id` to that verified id.
 */
export async function createTutorStore(studentId: string): Promise<TutorStore> {
  const db = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  return {
    asStudent: {
      async context(conversationId, subjectId, topic) {
        const { data, error } = await db.rpc("get_tutor_context", {
          p_conversation_id: conversationId,
          p_history: 12,
          ...(subjectId ? { p_subject_id: subjectId } : {}),
          ...(topic ? { p_topic: topic } : {}),
        });
        if (error || !data) return null;
        const parsed = tutorContextSchema.safeParse(data);
        if (!parsed.success) {
          console.error("get_tutor_context: unexpected shape", parsed.error.issues.slice(0, 3));
          return null;
        }
        return parsed.data;
      },
      async createConversation(c) {
        const { error } = await db.from("tutor_conversations").insert({
          id: c.id,
          student_id: studentId,
          title: c.title,
          subject_id: c.subjectId,
          topic: c.topic,
        });
        if (!error) return "ok";
        return error.code === "23505" ? "exists" : "error";
      },
      async updateConversationFocus(id, subjectId, topic) {
        await db.from("tutor_conversations").update({ subject_id: subjectId, topic }).eq("id", id);
      },
      async insertUserMessage(conversationId, content) {
        const { data, error } = await db
          .from("tutor_messages")
          .insert({ conversation_id: conversationId, student_id: studentId, role: "user", content })
          .select("id")
          .single();
        if (data) return { id: data.id };
        if (error?.message.includes("LUMIO:conversation_full")) return { error: "conversation_full" };
        if (error?.message.includes("LUMIO:not_found")) return { error: "not_found" };
        return { error: "unavailable" };
      },
      async specification(subjectId, qualificationId, boardId) {
        if (!boardId) return null;
        // Only published specifications are visible to students (RLS). None are loaded yet (Phase 5).
        const { data } = await db
          .from("specifications")
          .select("id, code, title")
          .eq("subject_id", subjectId)
          .eq("qualification_id", qualificationId)
          .eq("exam_board_id", boardId)
          .eq("status", "published")
          .limit(1)
          .maybeSingle();
        if (!data) return null;
        const { data: modules } = await db
          .from("curriculum_modules")
          .select("title")
          .eq("specification_id", data.id)
          .order("position")
          .limit(30);
        return { code: data.code, title: data.title, topics: (modules ?? []).map((m) => m.title) };
      },
    },

    asServer: {
      async insertAssistantMessage(m) {
        const { data, error } = await admin
          .from("tutor_messages")
          .insert({
            conversation_id: m.conversationId,
            student_id: studentId,
            role: "assistant",
            content: m.content,
            status: m.status,
            model: m.model,
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(`Saving tutor reply failed: ${error?.message}`);
        return { id: data.id };
      },
      async deleteMessage(id) {
        await admin.from("tutor_messages").delete().eq("id", id).eq("student_id", studentId);
      },
      async recordUsage(u) {
        const { error } = await admin.from("usage_events").insert({
          user_id: studentId,
          plan_id: u.planId,
          feature: u.feature,
          allowance: "tutor_messages",
          units: 1,
          provider: "anthropic",
          model: u.model,
          input_tokens: u.usage.inputTokens + u.usage.cacheWriteTokens,
          cached_input_tokens: u.usage.cacheReadTokens,
          output_tokens: u.usage.outputTokens,
          estimated_cost_usd_micros: u.costMicros,
          request_id: u.requestId,
          status: u.succeeded ? "succeeded" : "failed",
        });
        if (error) console.error("Recording tutor usage failed:", error.message);
      },
      async recordExposure(subjectId, topic, conversationId) {
        const { error } = await admin.rpc("service_record_learning", {
          p_student: studentId,
          p_subject: subjectId,
          p_topic: topic,
          p_kind: null,
          p_difficulty: null,
          p_score: null,
          p_misconception: null,
          p_approach: null,
          p_student_confidence: null,
          p_next_step: null,
          p_source: "tutor_conversation",
          p_conversation: conversationId,
        });
        if (error) console.error("Recording topic exposure failed:", error.message);
      },
      async recordLearning(e) {
        const { error } = await admin.rpc("service_record_learning", {
          p_student: studentId,
          p_subject: e.subjectId,
          p_topic: e.topic,
          p_kind: e.kind,
          p_difficulty: e.difficulty,
          p_score: null,
          p_misconception: e.misconception,
          p_approach: e.approach,
          p_student_confidence: e.studentConfidence,
          p_next_step: e.nextStep,
          p_source: "tutor_conversation",
          p_conversation: e.conversationId,
        });
        if (error) console.error("Recording learning evidence failed:", error.message);
      },
      async recordTutorActivity(conversationId, subjectId, title) {
        // One "Tutor session" entry per conversation in the activity ledger.
        // Tutor chat doesn't count towards streaks (see migration 0008), and
        // no duration is recorded because active time isn't measured.
        const { error } = await admin.from("study_activity_events").insert({
          student_id: studentId,
          activity_type: "tutor_session",
          subject_id: subjectId,
          title: title.slice(0, 120),
          source_table: "tutor_conversations",
          source_id: conversationId,
          local_date: new Date().toISOString().slice(0, 10), // replaced by trigger with the student's local date
        });
        if (error && error.code !== "23505") console.error("Recording tutor activity failed:", error.message);
      },
    },

    async names() {
      return tryGetReferenceData();
    },
  };
}
