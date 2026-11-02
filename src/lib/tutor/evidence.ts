import { z } from "zod";

/*
 * Learning evidence reported by the tutor IN THE SAME AI CALL as its reply,
 * via a tool ("record_learning_evidence"). No extra model call; the model only
 * spends ~50–100 output tokens when there is genuine evidence.
 *
 * The server never trusts it blindly: `acceptEvidence` re-checks every field,
 * drops anything that isn't academic, and refuses evidence that can't be
 * evidence (e.g. on the first message of a conversation, where the student
 * has only asked a question).
 */

export const EVIDENCE_TOOL_NAME = "record_learning_evidence";

export const EVIDENCE_KINDS = [
  "correct",
  "incorrect",
  "partial",
  "independent_explanation",
  "needed_reexplanation",
] as const;
export const APPROACHES = [
  "visual",
  "worked_example",
  "step_by_step",
  "questioning",
  "analogy",
  "detailed",
  "simplified",
] as const;
export const NEXT_STEPS = [
  "practise_more",
  "revisit_basics",
  "try_harder_questions",
  "try_exam_question",
  "move_on",
] as const;

/** JSON Schema sent to the provider (kept small: it's part of the cached prefix). */
export const EVIDENCE_TOOL = {
  name: EVIDENCE_TOOL_NAME,
  description:
    "Record what the student's LATEST message demonstrated about one topic. Call at most once, after writing your reply, and only when the student attempted an answer, explained something themselves, or said your explanation didn't make sense. Never call it when they only asked a question.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: { type: "string", description: "Exactly one of the student's subject names from <student_record>." },
      topic: {
        type: "string",
        description: "Short curriculum topic name (2–6 words). Reuse a name from <learning_profile> known topics when one fits.",
      },
      evidence: {
        type: "string",
        enum: [...EVIDENCE_KINDS],
        description:
          "correct / incorrect / partial = their answer to a question; independent_explanation = they explained it correctly unprompted; needed_reexplanation = they said they didn't understand your explanation.",
      },
      difficulty: { type: "string", enum: ["foundation", "standard", "challenging"] },
      misconception: {
        type: "string",
        description: "Only if incorrect/partial: the specific academic misunderstanding, ≤ 20 words. Never personal information.",
      },
      effective_approach: {
        type: "string",
        enum: [...APPROACHES],
        description: "Only if they now got it right: which of your approaches helped.",
      },
      student_confidence: { type: "string", enum: ["confident", "unsure"] },
      next_step: { type: "string", enum: [...NEXT_STEPS] },
    },
    required: ["subject", "topic", "evidence"],
  },
};

const short = (max: number) => z.string().trim().min(1).max(max);

export const evidenceInputSchema = z.object({
  subject: short(60),
  topic: short(60),
  evidence: z.enum(EVIDENCE_KINDS),
  difficulty: z.enum(["foundation", "standard", "challenging"]).optional(),
  misconception: short(200).optional(),
  effective_approach: z.enum(APPROACHES).optional(),
  student_confidence: z.enum(["confident", "unsure"]).optional(),
  next_step: z.enum(NEXT_STEPS).optional(),
});
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

/** Anything that looks like contact details or identity — never stored as academic memory. */
const PERSONAL = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /(\+?\d[\d\s-]{8,}\d)/, // phone-like numbers
  /https?:\/\/|www\./i, // links
  /@\w{2,}/, // handles
  /\b(my|his|her|their) (mum|mom|dad|parents?|family|boyfriend|girlfriend|address|school is)\b/i,
  /\b(anxious|depress|self[- ]?harm|suicid|abuse|bull(y|ied)|eating disorder)\w*/i,
];
export const looksPersonal = (text: string) => PERSONAL.some((p) => p.test(text));

export type AcceptedEvidence = {
  subjectId: string;
  topic: string;
  kind: (typeof EVIDENCE_KINDS)[number];
  difficulty: "foundation" | "standard" | "challenging";
  misconception: string | null;
  approach: (typeof APPROACHES)[number] | null;
  studentConfidence: "confident" | "unsure" | null;
  nextStep: (typeof NEXT_STEPS)[number] | null;
};

export type EvidenceDecision = { ok: true; evidence: AcceptedEvidence } | { ok: false; reason: string };

export function acceptEvidence(
  raw: unknown,
  ctx: {
    /** The student's subjects: id + display name. */
    subjects: { id: string; name: string }[];
    /** Did the tutor speak in this conversation before the student's latest message? */
    hadPriorTutorTurn: boolean;
  },
): EvidenceDecision {
  const parsed = evidenceInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "malformed" };
  const e = parsed.data;
  // A question on its own is never evidence of weakness or strength.
  if (!ctx.hadPriorTutorTurn) return { ok: false, reason: "no prior tutor turn" };
  const subject = ctx.subjects.find((s) => s.name.toLowerCase() === e.subject.toLowerCase());
  if (!subject) return { ok: false, reason: "unknown subject" };
  if (!/[a-z0-9]/i.test(e.topic) || looksPersonal(e.topic)) return { ok: false, reason: "topic not academic" };
  const misconception =
    e.misconception && (e.evidence === "incorrect" || e.evidence === "partial") && !looksPersonal(e.misconception)
      ? e.misconception
      : null;
  return {
    ok: true,
    evidence: {
      subjectId: subject.id,
      topic: e.topic.replace(/\s+/g, " "),
      kind: e.evidence,
      difficulty: e.difficulty ?? "standard",
      misconception,
      // "What helped" only makes sense when they got it.
      approach: e.evidence === "correct" || e.evidence === "independent_explanation" ? (e.effective_approach ?? null) : null,
      studentConfidence: e.student_confidence ?? null,
      nextStep: e.next_step ?? null,
    },
  };
}
