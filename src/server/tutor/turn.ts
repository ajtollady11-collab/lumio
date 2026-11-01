import { estimateCostMicros, MODELS, type TokenUsage } from "@/lib/ai/models";
import { COMPLEX_BUDGET, routeTutorModel } from "@/lib/ai/router";
import {
  curriculumFor,
  normaliseTurns,
  studentContextFrom,
  trimHistory,
  tutorSettingsFrom,
  type Names,
  type TutorContextRow,
} from "@/lib/tutor/context";
import { buildTutorSystem, MAX_TOKENS_BY_DEPTH, type CurriculumContext } from "@/lib/tutor/prompt";
import { checkQuota } from "@/lib/tutor/quota";
import { titleFromMessage, type ChatRequest } from "@/lib/tutor/schemas";
import type { TutorErrorCode, TutorStreamEvent } from "@/lib/tutor/stream";
import type { ChatProvider } from "@/server/ai/provider";
import { ProviderError } from "@/server/ai/provider";

/*
 * One tutor turn, start to finish:
 *   context (1 RPC) → consent & quota → conversation → save the student's
 *   message → route model → build prompt → stream reply → save reply, usage,
 *   memory and activity.
 *
 * Dependencies are injected so the whole flow is unit-tested with fakes.
 * `store.asStudent` runs with the student's session (RLS); `store.asServer`
 * uses the secret key for writes students must not be able to forge.
 */

export type TutorStore = {
  asStudent: {
    context(conversationId: string): Promise<TutorContextRow | null>;
    createConversation(c: {
      id: string;
      title: string;
      subjectId: string | null;
      topic: string | null;
    }): Promise<"ok" | "exists" | "error">;
    updateConversationFocus(id: string, subjectId: string | null, topic: string | null): Promise<void>;
    insertUserMessage(conversationId: string, content: string): Promise<{ id: string } | { error: TutorErrorCode }>;
    specification(
      subjectId: string,
      qualificationId: string,
      boardId: string | null,
    ): Promise<CurriculumContext["specification"]>;
  };
  asServer: {
    insertAssistantMessage(m: {
      conversationId: string;
      content: string;
      status: "complete" | "interrupted";
      model: string;
    }): Promise<{ id: string }>;
    deleteMessage(id: string): Promise<void>;
    recordUsage(u: {
      planId: string;
      feature: string;
      model: string;
      usage: TokenUsage;
      costMicros: number;
      requestId: string | null;
      succeeded: boolean;
    }): Promise<void>;
    rememberTopic(subjectId: string, topic: string): Promise<void>;
    recordTutorActivity(conversationId: string, subjectId: string | null, title: string): Promise<void>;
  };
  names(): Promise<Names | null>;
};

export type TurnInput = { request: ChatRequest; signal?: AbortSignal };

const fail = (code: TutorErrorCode, message: string): TutorStreamEvent => ({ type: "error", code, message });

/** Rough token estimate (≈4 characters per token) — used only when the provider didn't report usage. */
const approxTokens = (chars: number) => Math.ceil(chars / 4);

export async function* runTutorTurn(
  { request, signal }: TurnInput,
  store: TutorStore,
  provider: ChatProvider,
): AsyncGenerator<TutorStreamEvent> {
  const [row, names] = await Promise.all([store.asStudent.context(request.conversationId), store.names()]);
  if (!row || !names) return yield fail("unavailable", "Lumio's servers couldn't be reached. Try again in a moment.");

  // Under-13s need a linked parent before AI features run (UK Children's Code).
  if (row.profile.parentalConsent === "pending" || row.profile.parentalConsent === "withdrawn") {
    return yield fail(
      "consent_required",
      "A parent or carer needs to link their Lumio account before your tutor can start. You can find out how in Settings → Family.",
    );
  }

  const quota = checkQuota(row.quota);
  if (!quota.ok) return yield fail(quota.code, quota.message);

  // Conversation: create on first message, otherwise it must already be the student's own.
  let conversation = row.conversation;
  const subjectId = request.subjectId ?? conversation?.subjectId ?? null;
  const topic = request.topic ?? conversation?.topic ?? null;
  if (subjectId && !row.subjects.some((s) => s.subjectId === subjectId)) {
    return yield fail("invalid", "Choose one of your own subjects.");
  }
  let title = conversation?.title ?? titleFromMessage(request.content, topic);
  if (!conversation) {
    if (!request.isNew) return yield fail("not_found", "That conversation couldn't be found.");
    const created = await store.asStudent.createConversation({ id: request.conversationId, title, subjectId, topic });
    if (created !== "ok")
      return yield fail(
        created === "exists" ? "not_found" : "unavailable",
        "Couldn't start the conversation. Try again.",
      );
    conversation = { id: request.conversationId, title, subjectId, topic, messageCount: 0 };
  } else if (subjectId !== conversation.subjectId || topic !== conversation.topic) {
    await store.asStudent.updateConversationFocus(conversation.id, subjectId, topic);
  }
  title = conversation.title;

  const saved = await store.asStudent.insertUserMessage(conversation.id, request.content);
  if ("error" in saved) {
    return yield fail(
      saved.error,
      saved.error === "conversation_full"
        ? "This conversation is full. Start a new one to carry on."
        : "Your message couldn't be saved. Try again.",
    );
  }

  // Context for the prompt.
  const student = studentContextFrom(row, names);
  const tutor = tutorSettingsFrom(row);
  const subjectRow = subjectId ? row.subjects.find((s) => s.subjectId === subjectId) : undefined;
  const spec = subjectRow
    ? await store.asStudent.specification(subjectRow.subjectId, subjectRow.qualificationId, subjectRow.examBoardId)
    : null;

  const history = row.history;
  const route = routeTutorModel({
    message: request.content,
    previousUserMessages: history.filter((h) => h.role === "user").map((h) => h.content),
    complexUsed: row.quota.complexUsedThisMonth,
    complexBudget: COMPLEX_BUDGET[row.quota.planId] ?? 0,
  });
  const system = buildTutorSystem({
    tutor,
    student,
    focus: { subject: curriculumFor(student, subjectId, spec), topic, struggling: route.struggling },
  });
  const turns = normaliseTurns([...trimHistory(history), { role: "user", content: request.content }]);

  yield { type: "start", conversationId: conversation.id, userMessageId: saved.id, title, model: route.model };

  // Stream the reply.
  let text = "";
  let usage: TokenUsage | null = null;
  let requestId: string | null = null;
  let interrupted = false;
  try {
    for await (const chunk of provider.stream({
      model: route.model,
      system: [{ text: system.foundation, cache: true }, { text: system.personal }],
      messages: turns,
      maxTokens: MAX_TOKENS_BY_DEPTH[tutor.depth],
      signal,
    })) {
      if (chunk.type === "text") {
        text += chunk.text;
        yield { type: "delta", text: chunk.text };
      } else {
        usage = chunk.usage;
        requestId = chunk.requestId;
        if (chunk.stopReason === "max_tokens") interrupted = true;
      }
    }
  } catch (error) {
    const kind = error instanceof ProviderError ? error.kind : "unknown";
    if (kind === "aborted") {
      interrupted = true;
    } else if (!text) {
      // Nothing generated: remove the unanswered message so a retry doesn't duplicate it.
      await store.asServer.deleteMessage(saved.id).catch(() => {});
      if (kind === "auth") console.error("Tutor provider rejected the API key — check ANTHROPIC_API_KEY.");
      else console.error(`Tutor provider error: ${kind}`);
      return yield fail(
        "provider_error",
        kind === "rate_limited" || kind === "overloaded"
          ? "Your tutor is very busy right now. Wait a few seconds and send your message again."
          : "Your tutor couldn't reply just now. Your message is still in the box — try sending it again.",
      );
    } else {
      interrupted = true;
    }
  }

  if (!text.trim()) {
    await store.asServer.deleteMessage(saved.id).catch(() => {});
    return yield fail("provider_error", "Your tutor didn't reply. Try sending your message again.");
  }

  const reply = await store.asServer.insertAssistantMessage({
    conversationId: conversation.id,
    content: text.slice(0, 12_000),
    status: interrupted ? "interrupted" : "complete",
    model: route.model,
  });

  const finalUsage: TokenUsage = usage ?? {
    inputTokens: approxTokens(
      system.foundation.length + system.personal.length + turns.reduce((n, t) => n + t.content.length, 0),
    ),
    outputTokens: approxTokens(text.length),
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  };
  // Bookkeeping must never break the student's reply.
  await Promise.allSettled([
    store.asServer.recordUsage({
      planId: row.quota.planId,
      feature: route.tier === "capable" ? "tutor.chat.complex" : "tutor.chat",
      model: route.model,
      usage: finalUsage,
      costMicros: MODELS[route.model] ? estimateCostMicros(route.model, finalUsage) : 0,
      requestId,
      succeeded: true,
    }),
    subjectId && topic ? store.asServer.rememberTopic(subjectId, topic) : Promise.resolve(),
    conversation.messageCount === 0
      ? store.asServer.recordTutorActivity(conversation.id, subjectId, title)
      : Promise.resolve(),
  ]);

  yield { type: "done", messageId: reply.id, interrupted };
}
