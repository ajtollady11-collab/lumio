/*
 * Wire protocol for POST /api/tutor/chat: newline-delimited JSON events.
 * Shared by the server (encode) and the browser (decode).
 */

export type TutorErrorCode =
  | "not_configured"
  | "unauthenticated"
  | "forbidden"
  | "consent_required"
  | "invalid"
  | "not_found"
  | "rate_limited"
  | "allowance_exhausted"
  | "conversation_full"
  | "provider_error"
  | "unavailable";

export type TutorStreamEvent =
  | { type: "start"; conversationId: string; userMessageId: string; title: string; model: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; interrupted: boolean }
  | { type: "error"; code: TutorErrorCode; message: string; missing?: string[] };

export function encodeEvent(event: TutorStreamEvent): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`) as Uint8Array<ArrayBuffer>;
}

/** Incrementally decodes NDJSON chunks; tolerates events split across chunks. */
export function createEventDecoder() {
  const decoder = new TextDecoder();
  let buffer = "";
  return (chunk: Uint8Array | undefined, final = false): TutorStreamEvent[] => {
    if (chunk) buffer += decoder.decode(chunk, { stream: !final });
    const lines = buffer.split("\n");
    buffer = final ? "" : (lines.pop() ?? "");
    return lines.filter((l) => l.trim()).map((l) => JSON.parse(l) as TutorStreamEvent);
  };
}
