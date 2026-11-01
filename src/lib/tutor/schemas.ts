import { z } from "zod";
import { DEPTHS, PACES, PERSONALITIES, TEACHING_STYLES, TUTOR_NAME_PATTERN } from "./options";

export const MAX_USER_MESSAGE = 2000;
export const MAX_TOPIC = 80;
export const MAX_TITLE = 80;

const values = <T extends { value: string }>(list: T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];

export const tutorSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your tutor a name.")
    .max(24, "Keep the name to 24 characters or fewer.")
    .regex(TUTOR_NAME_PATTERN, "Use letters, numbers, spaces, apostrophes, full stops or hyphens."),
  personality: z.enum(values(PERSONALITIES)),
  teachingStyle: z.enum(values(TEACHING_STYLES)),
  pace: z.enum(values(PACES)),
  depth: z.enum(values(DEPTHS)),
});

/** Body of POST /api/tutor/chat. Never contains a student id — that comes from the session. */
export const chatRequestSchema = z.object({
  conversationId: z.uuid(),
  /** True when the client is creating this conversation with its first message. */
  isNew: z.boolean().default(false),
  content: z
    .string()
    .trim()
    .min(1, "Type a message first.")
    .max(MAX_USER_MESSAGE, `Keep messages to ${MAX_USER_MESSAGE} characters or fewer.`),
  subjectId: z.uuid().nullable().default(null),
  topic: z
    .string()
    .trim()
    .max(MAX_TOPIC)
    .transform((v) => v || null)
    .nullable()
    .default(null),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const renameSchema = z.object({
  conversationId: z.uuid(),
  title: z.string().trim().min(1, "Give the conversation a title.").max(MAX_TITLE),
});

/** A readable title from the first message — no extra AI call. */
export function titleFromMessage(content: string, topic?: string | null): string {
  if (topic) return topic.slice(0, MAX_TITLE);
  const clean = content
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?!.]+$/, "");
  if (clean.length <= 60) return clean || "New conversation";
  const cut = clean.slice(0, 60);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 30 ? cut.lastIndexOf(" ") : 60)}…`;
}
