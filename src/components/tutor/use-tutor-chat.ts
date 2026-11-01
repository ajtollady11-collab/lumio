"use client";

import { useCallback, useRef, useState } from "react";
import { createEventDecoder, type TutorErrorCode } from "@/lib/tutor/stream";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "interrupted" | "streaming";
};

export type ChatError = { code: TutorErrorCode; message: string; missing?: string[] };

type SendArgs = { content: string; subjectId: string | null; topic: string | null };

/**
 * Talks to POST /api/tutor/chat. The student's message appears immediately;
 * the reply streams in word by word. On any failure the optimistic messages
 * are removed and `onRestore` hands the text back to the composer so nothing
 * typed is lost.
 */
export function useTutorChat({
  initialMessages,
  conversationId: initialId,
  onStarted,
  onRestore,
}: {
  initialMessages: ChatMessage[];
  conversationId: string | null;
  onStarted?: (c: { id: string; title: string; isNew: boolean }) => void;
  onRestore?: (content: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialId);
  const [phase, setPhase] = useState<"idle" | "waiting" | "streaming">("idle");
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ content, subjectId, topic }: SendArgs) => {
      if (phase !== "idle") return;
      const isNew = !conversationId;
      const id = conversationId ?? crypto.randomUUID();
      const userTemp = `user-${Date.now()}`;
      const replyTemp = `reply-${Date.now()}`;
      setError(null);
      setPhase("waiting");
      setMessages((m) => [
        ...m,
        { id: userTemp, role: "user", content, status: "complete" },
        { id: replyTemp, role: "assistant", content: "", status: "streaming" },
      ]);

      const rollback = (err: ChatError) => {
        setMessages((m) => m.filter((x) => x.id !== userTemp && x.id !== replyTemp));
        setError(err);
        onRestore?.(content);
      };

      const controller = new AbortController();
      abortRef.current = controller;
      let started = false;
      let gotText = false;
      try {
        const response = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId: id, isNew, content, subjectId, topic }),
          signal: controller.signal,
        });
        if (!response.body) throw new Error("No response body");
        const reader = response.body.getReader();
        const decode = createEventDecoder();
        let finished = false;
        while (!finished) {
          const { value, done } = await reader.read();
          for (const event of decode(value, done)) {
            if (event.type === "start") {
              started = true;
              setConversationId(event.conversationId);
              setMessages((m) => m.map((x) => (x.id === userTemp ? { ...x, id: event.userMessageId } : x)));
              onStarted?.({ id: event.conversationId, title: event.title, isNew });
            } else if (event.type === "delta") {
              gotText = true;
              setPhase("streaming");
              setMessages((m) => m.map((x) => (x.id === replyTemp ? { ...x, content: x.content + event.text } : x)));
            } else if (event.type === "done") {
              setMessages((m) =>
                m.map((x) =>
                  x.id === replyTemp
                    ? { ...x, id: event.messageId, status: event.interrupted ? "interrupted" : "complete" }
                    : x,
                ),
              );
            } else if (event.type === "error") {
              rollback({ code: event.code, message: event.message, missing: event.missing });
            }
          }
          finished = done;
        }
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        if (aborted && gotText) {
          // The server saves what was generated as an interrupted reply.
          setMessages((m) => m.map((x) => (x.id === replyTemp ? { ...x, status: "interrupted" } : x)));
        } else if (aborted && !started) {
          rollback({ code: "unavailable", message: "Stopped before your tutor replied." });
        } else if (aborted) {
          setMessages((m) => m.filter((x) => x.id !== replyTemp));
        } else {
          rollback({
            code: "unavailable",
            message: "Your connection dropped. Your message is back in the box — try again.",
          });
        }
      } finally {
        abortRef.current = null;
        setPhase("idle");
      }
    },
    [conversationId, phase, onStarted, onRestore],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const prepend = useCallback((older: ChatMessage[]) => setMessages((m) => [...older, ...m]), []);
  const dismissError = useCallback(() => setError(null), []);

  return { messages, conversationId, phase, error, send, stop, prepend, dismissError };
}
