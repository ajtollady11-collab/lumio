/**
 * Display copy for subscription plans on public pages.
 *
 * The authoritative prices and allowances live in the `subscription_plans`
 * table (editable from the admin dashboard in Phase 7) and in Stripe. This file
 * is only the marketing fallback and must match the database seed in
 * supabase/migrations/*_commerce.sql.
 */
export type PlanId = "free" | "premium" | "family";

export type PlanDisplay = {
  id: PlanId;
  name: string;
  monthlyPricePence: number;
  summary: string;
  highlights: string[];
  availability: "available" | "planned";
};

export const PLANS: readonly PlanDisplay[] = [
  {
    id: "free",
    name: "Lumio Free",
    monthlyPricePence: 0,
    summary: "Meet your tutor and try a lesson.",
    highlights: ["Your own tutor", "A limited number of lessons and messages", "Flashcards and quizzes"],
    availability: "available",
  },
  {
    id: "premium",
    name: "Lumio Premium",
    monthlyPricePence: 2999,
    summary: "Full lessons, voice tutoring and exam practice.",
    highlights: [
      "Structured live lessons",
      "Voice tutoring",
      "Marked exam-style practice",
      "Revision timetable and notes",
      "Parent reports",
    ],
    availability: "available",
  },
  {
    id: "family",
    name: "Lumio Family",
    monthlyPricePence: 4499,
    summary: "Premium for up to three students, one family dashboard.",
    highlights: ["Up to three student accounts", "A separate tutor for each child", "Combined parent dashboard"],
    availability: "planned",
  },
] as const;

export function formatPrice(pence: number): string {
  if (pence === 0) return "£0";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}
