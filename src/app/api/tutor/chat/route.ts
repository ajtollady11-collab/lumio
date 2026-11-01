import { getViewerState } from "@/lib/auth/session";
import { chatRequestSchema } from "@/lib/tutor/schemas";
import { encodeEvent, type TutorErrorCode, type TutorStreamEvent } from "@/lib/tutor/stream";
import { tutorReadiness } from "@/server/ai/config";
import { createAnthropicProvider } from "@/server/ai/provider";
import { createTutorStore } from "@/server/tutor/store";
import { runTutorTurn } from "@/server/tutor/turn";

/*
 * POST /api/tutor/chat — one tutor turn, streamed as NDJSON events.
 *
 * Security: the student is identified ONLY from the verified session; the
 * body never carries a student id. Role, onboarding, configuration, input
 * size and shape are checked before any AI call. API keys never leave the
 * server; errors returned to the browser never include internal details.
 */

export const maxDuration = 60;

const MAX_BODY_BYTES = 16_000;

function errorResponse(code: TutorErrorCode, message: string, status: number, extra: Partial<TutorStreamEvent> = {}) {
  return new Response(encodeEvent({ type: "error", code, message, ...extra } as TutorStreamEvent), {
    status,
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const state = await getViewerState();
  if (state.status === "unavailable") return errorResponse("unavailable", "Lumio's servers couldn't be reached.", 503);
  if (state.status === "signed_out")
    return errorResponse("unauthenticated", "Sign in again to talk to your tutor.", 401);
  const viewer = state.viewer;
  if (viewer.role !== "student") return errorResponse("forbidden", "The tutor is for student accounts.", 403);
  if (!viewer.onboarded) return errorResponse("forbidden", "Finish setting up your account first.", 403);

  const readiness = tutorReadiness();
  if (!readiness.ready) {
    return errorResponse("not_configured", "The tutor hasn't been connected to an AI provider yet.", 503, {
      missing: readiness.missing,
    });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return errorResponse("invalid", "That message is too long.", 413);
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return errorResponse("invalid", "The request couldn't be read.", 400);
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid", parsed.error.issues[0]?.message ?? "Invalid message.", 400);

  const store = await createTutorStore(viewer.id);
  const provider = createAnthropicProvider();
  const turn = runTutorTurn({ request: parsed.data, signal: request.signal }, store, provider);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of turn) {
          try {
            controller.enqueue(encodeEvent(event));
          } catch {
            // Client went away; keep draining so the reply is still saved.
          }
        }
      } catch (error) {
        console.error("Tutor turn failed:", error instanceof Error ? error.message : error);
        try {
          controller.enqueue(
            encodeEvent({ type: "error", code: "unavailable", message: "Something went wrong. Try again." }),
          );
        } catch {}
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
