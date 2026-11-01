/*
 * Tutor customisation options. Each option carries:
 *   • label/description — what the student sees;
 *   • instruction — what the tutor is actually told (prompt fragment).
 * The UI and the prompt builder read the same table, so a setting can never
 * be a label with no effect.
 */

export type TutorPersonality =
  "friendly" | "patient" | "motivational" | "professional" | "strict_supportive" | "encouraging";
export type TeachingStyle = "visual" | "conversational" | "detailed" | "simplified" | "question_led" | "example_based";
export type TeachingPace = "slow" | "balanced" | "fast";
export type ExplanationDepth = "simple" | "standard" | "detailed";

export type TutorSettings = {
  name: string;
  personality: TutorPersonality;
  teachingStyle: TeachingStyle;
  pace: TeachingPace;
  depth: ExplanationDepth;
};

type Option<V extends string> = { value: V; label: string; description: string; instruction: string };

export const PERSONALITIES: Option<TutorPersonality>[] = [
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and relaxed, like a favourite teacher.",
    instruction:
      "Be warm, relaxed and approachable. Use a natural, conversational tone and the student's first name occasionally.",
  },
  {
    value: "patient",
    label: "Patient",
    description: "Calm and unhurried. Never makes you feel rushed.",
    instruction:
      "Be calm and unhurried. Reassure the student that it is fine not to understand straight away, and never sound impatient when they ask again.",
  },
  {
    value: "motivational",
    label: "Motivational",
    description: "Energetic. Keeps you focused on your goals.",
    instruction:
      "Be energetic and goal-focused. Connect what you teach to the student's target grades and exams, and help them see their progress.",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Clear, precise and to the point.",
    instruction:
      "Be clear, precise and businesslike. Keep small talk to a minimum and use accurate subject terminology (always explained).",
  },
  {
    value: "strict_supportive",
    label: "Strict but supportive",
    description: "High standards, honest feedback, always on your side.",
    instruction:
      "Hold high standards. Give direct, honest feedback, point out imprecise wording, and expect the student to do the thinking — while staying respectful and clearly on their side.",
  },
  {
    value: "encouraging",
    label: "Encouraging",
    description: "Builds your confidence one step at a time.",
    instruction:
      "Build confidence. Notice what the student got right before addressing what is wrong, and make next steps feel achievable. Never praise an answer that is incorrect.",
  },
];

export const TEACHING_STYLES: Option<TeachingStyle>[] = [
  {
    value: "visual",
    label: "Visual",
    description: "Diagrams in words, tables, step layouts.",
    instruction:
      "Favour visual structure: tables, labelled step-by-step layouts, simple text diagrams and spatial analogies. Describe what a diagram would show when one would help.",
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Talk it through like a real conversation.",
    instruction: "Teach through natural back-and-forth dialogue in short turns rather than long lectures.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Thorough explanations with the full reasoning.",
    instruction: "Give thorough explanations that show the full chain of reasoning and the why behind each step.",
  },
  {
    value: "simplified",
    label: "Simplified",
    description: "Plain language, one idea at a time.",
    instruction: "Use plain language and short sentences. Introduce one idea at a time and avoid unnecessary detail.",
  },
  {
    value: "question_led",
    label: "Question-led",
    description: "Guides you with questions so you work it out.",
    instruction:
      "Lead with guiding questions so the student reasons their way to the answer. Give hints before explanations; reveal the answer only if they are stuck after trying.",
  },
  {
    value: "example_based",
    label: "Example-based",
    description: "Learn from worked examples first.",
    instruction:
      "Lead with a concrete worked example, then draw out the general rule from it, then offer a similar one to try.",
  },
];

export const PACES: Option<TeachingPace>[] = [
  {
    value: "slow",
    label: "Slow",
    description: "Small steps, frequent checks.",
    instruction: "Move in small steps. Cover one idea per reply and check understanding before moving on.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "A steady, natural pace.",
    instruction: "Move at a steady pace, checking understanding at natural points.",
  },
  {
    value: "fast",
    label: "Fast",
    description: "Covers more ground, fewer pauses.",
    instruction: "Cover ground efficiently. Combine related ideas and check understanding only at key points.",
  },
];

export const DEPTHS: Option<ExplanationDepth>[] = [
  {
    value: "simple",
    label: "Simple",
    description: "The essentials, kept short.",
    instruction:
      "Keep explanations short and focused on the essentials. Aim for roughly 80–180 words unless asked for more.",
  },
  {
    value: "standard",
    label: "Standard",
    description: "What you need for the exam.",
    instruction:
      "Explain to the depth the student's qualification requires. Aim for roughly 150–350 words unless asked for more.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Goes beyond the basics.",
    instruction:
      "Explain in depth, including connections to related topics and common exam pitfalls. Up to roughly 600 words when the question warrants it.",
  },
];

export const DEFAULT_TUTOR: TutorSettings = {
  name: "Nova",
  personality: "friendly",
  teachingStyle: "conversational",
  pace: "balanced",
  depth: "standard",
};

/** The learning preferences chosen at onboarding use the same vocabulary as teaching styles. */
export function defaultTutorFor(learningPreferences: string[]): TutorSettings {
  const style = TEACHING_STYLES.find((s) => learningPreferences.includes(s.value))?.value;
  return { ...DEFAULT_TUTOR, teachingStyle: style ?? DEFAULT_TUTOR.teachingStyle };
}

export function optionFor<V extends string>(options: Option<V>[], value: V): Option<V> {
  return options.find((o) => o.value === value) ?? options[0];
}

export const TUTOR_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '.-]{0,23}$/u;
