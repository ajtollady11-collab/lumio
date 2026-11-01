import type { Enums } from "@/types/database";

/*
 * Labels and option sets for onboarding and profile settings. Values match the
 * database enums and check constraints exactly; labels are what students see.
 */

export type AgeBand = Enums<"age_band">;
export type EducationLevel = Enums<"education_level">;
export type QualificationLevel = Enums<"qualification_level">;
export type Confidence = Enums<"subject_confidence">;

export const AGE_BANDS: readonly { value: AgeBand; label: string }[] = [
  { value: "under_13", label: "Under 13" },
  { value: "13_15", label: "13–15" },
  { value: "16_17", label: "16–17" },
  { value: "18_plus", label: "18 or over" },
];

export const SCHOOL_YEARS: readonly { value: number; label: string }[] = [
  { value: 7, label: "Year 7" },
  { value: 8, label: "Year 8" },
  { value: 9, label: "Year 9" },
  { value: 10, label: "Year 10" },
  { value: 11, label: "Year 11" },
  { value: 12, label: "Year 12" },
  { value: 13, label: "Year 13" },
  { value: 14, label: "Year 14 or resitting" },
];

export const EDUCATION_LEVELS: readonly { value: EducationLevel; label: string; description: string }[] = [
  { value: "gcse", label: "GCSE", description: "Usually Years 10 and 11" },
  { value: "a_level", label: "A-level", description: "Usually Years 12 and 13" },
  {
    value: "igcse",
    label: "International GCSE",
    description: "Often studied at international and independent schools",
  },
  { value: "other", label: "Something else", description: "Lumio supports GCSE and A-level first; more is coming" },
];

/** The qualification slug a level most often maps to — used as the suggested default. */
export const SUGGESTED_QUALIFICATION: Record<EducationLevel, string | null> = {
  gcse: "gcse",
  a_level: "a-level",
  igcse: "international-gcse",
  other: null,
};

export const LEARNING_PREFERENCES = [
  {
    value: "visual",
    label: "Visual explanations",
    description: "Diagrams, graphs and drawings that show how things work",
  },
  {
    value: "conversational",
    label: "Conversational teaching",
    description: "Talking it through, like a one-to-one lesson",
  },
  { value: "detailed", label: "Detailed explanations", description: "The full reasoning, step by step" },
  { value: "simplified", label: "Simplified explanations", description: "The core idea first, in plain words" },
  { value: "example_based", label: "Practical examples", description: "Worked examples and real situations" },
  {
    value: "question_led",
    label: "Question-led learning",
    description: "Being asked questions that lead you to the answer",
  },
] as const;

export type LearningPreference = (typeof LEARNING_PREFERENCES)[number]["value"];
export const LEARNING_PREFERENCE_VALUES = LEARNING_PREFERENCES.map((p) => p.value) as [
  LearningPreference,
  ...LearningPreference[],
];

export const CONFIDENCE_OPTIONS: readonly { value: Confidence; label: string }[] = [
  { value: "difficult", label: "Finding it hard" },
  { value: "neutral", label: "Getting there" },
  { value: "confident", label: "Confident" },
];

/** Grade scales, highest first. Must match private.grade_is_valid() in the database. */
export const GRADE_SCALES: Record<QualificationLevel, readonly string[]> = {
  gcse: ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"],
  igcse: ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"],
  a_level: ["A*", "A", "B", "C", "D", "E", "U"],
  as_level: ["A", "B", "C", "D", "E", "U"],
};

export function gradeIsValid(level: QualificationLevel, grade: string | null | undefined): boolean {
  return grade == null || GRADE_SCALES[level].includes(grade);
}

export function labelFor<T extends string | number>(
  options: readonly { value: T; label: string }[],
  value: T | null | undefined,
): string | null {
  return options.find((o) => o.value === value)?.label ?? null;
}
