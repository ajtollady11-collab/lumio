/*
 * Suggested opening questions, built from what the student has actually set
 * up (subjects, exams, chosen topic). No AI call.
 */

export type SuggestionInput = {
  subject: { name: string; qualificationName: string; nextExamDays: number | null; confidence: string | null } | null;
  topic: string | null;
  firstSubjects: { name: string; qualificationName: string }[];
};

export function suggestedQuestions(i: SuggestionInput): string[] {
  if (i.subject && i.topic) {
    return [
      `Explain ${i.topic} for ${i.subject.qualificationName} ${i.subject.name}`,
      `What are the most common mistakes students make with ${i.topic}?`,
      `Give me an exam-style practice question on ${i.topic}`,
      `Check my understanding of ${i.topic} with a few quick questions`,
    ];
  }
  if (i.subject) {
    const out = [
      `What are the key topics in ${i.subject.qualificationName} ${i.subject.name}?`,
      `Help me with a ${i.subject.name} topic I find hard`,
      `Give me a ${i.subject.name} question to warm up`,
    ];
    if (i.subject.nextExamDays !== null && i.subject.nextExamDays <= 60)
      out.unshift(`My ${i.subject.name} exam is in ${i.subject.nextExamDays} days — how should I revise?`);
    return out.slice(0, 4);
  }
  const subs = i.firstSubjects.slice(0, 2);
  return [
    ...subs.map((s) => `Help me understand something in ${s.qualificationName} ${s.name}`),
    "How do you work as my tutor?",
    "Make me a revision plan for this week",
  ].slice(0, 4);
}
