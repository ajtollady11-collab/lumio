"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getViewerState } from "@/lib/auth/session";
import { failure, fromDatabaseError, success, type ActionResult, type Failure } from "@/lib/errors";
import { gradeIsValid } from "@/lib/onboarding/options";
import {
  aboutSchema,
  boardsSchema,
  examSchema,
  goalsSchema,
  londonToday,
  preferencesSchema,
  qualificationSchema,
  subjectsSchema,
} from "@/lib/onboarding/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReferenceData } from "@/server/curriculum/reference";
import type { ExamRow } from "./student-data";

/*
 * Student onboarding and profile writes.
 *
 * Every action: re-checks the session and role, validates input with zod,
 * writes as the signed-in user (RLS applies), and maps any failure to a
 * friendly message. `advanceTo` records progress so a student can leave and
 * resume on any device; it only ever moves forward.
 */

type Mode = { advanceTo?: number };

type StudentContext = { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; studentId: string };

async function studentContext(): Promise<StudentContext | Failure> {
  const state = await getViewerState();
  if (state.status === "unavailable") return failure("unavailable");
  if (state.status === "signed_out") return failure("session_expired");
  if (state.viewer.role !== "student") return failure("forbidden");
  return { supabase: await createSupabaseServerClient(), studentId: state.viewer.id };
}

function isFailure(x: unknown): x is Failure {
  return typeof x === "object" && x !== null && (x as Failure).ok === false;
}

function fieldErrors(error: z.ZodError): Failure {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    out[key] ??= issue.message;
  }
  return failure("invalid", error.issues[0]?.message ?? undefined, out);
}

async function advance(ctx: StudentContext, step: number | undefined) {
  if (!step) return;
  // Only moves forward; ignore failures here (the data itself is already saved).
  await ctx.supabase
    .from("student_profiles")
    .update({ onboarding_step: Math.min(Math.max(step, 1), 8) })
    .eq("profile_id", ctx.studentId)
    .lt("onboarding_step", step);
}

// ---------------------------------------------------------------------------

export async function saveAbout(input: unknown, mode: Mode = {}): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = aboutSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;

  const { error } = await ctx.supabase
    .from("student_profiles")
    .update({
      first_name: v.firstName,
      age_band: v.ageBand,
      school_year: v.schoolYear,
      education_level: v.educationLevel,
    })
    .eq("profile_id", ctx.studentId);
  if (error) return fromDatabaseError(error);

  await advance(ctx, mode.advanceTo);
  return success();
}

export async function saveQualification(input: unknown, mode: Mode = {}): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = qualificationSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const ref = await getReferenceData().catch(() => null);
  if (!ref) return failure("unavailable");
  if (!ref.qualifications.some((q) => q.id === parsed.data.qualificationId)) return failure("invalid");

  const { error } = await ctx.supabase
    .from("student_profiles")
    .update({ primary_qualification_id: parsed.data.qualificationId })
    .eq("profile_id", ctx.studentId);
  if (error) return fromDatabaseError(error);

  await advance(ctx, mode.advanceTo);
  return success();
}

/**
 * Replaces the student's subject list. New subjects start on the student's
 * main qualification with no board chosen; removed subjects take their exam
 * dates with them. Existing subjects keep their boards and grades.
 */
export async function saveSubjects(input: unknown, mode: Mode = {}): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = subjectsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const wanted = new Set(parsed.data.subjectIds);

  const ref = await getReferenceData().catch(() => null);
  if (!ref) return failure("unavailable");
  if ([...wanted].some((id) => !ref.subjects.some((s) => s.id === id))) return failure("invalid");

  const [profile, current] = await Promise.all([
    ctx.supabase.from("student_profiles").select("primary_qualification_id").eq("profile_id", ctx.studentId).single(),
    ctx.supabase.from("student_subjects").select("subject_id").eq("student_id", ctx.studentId),
  ]);
  if (profile.error) return fromDatabaseError(profile.error);
  if (current.error) return fromDatabaseError(current.error);
  const qualificationId = profile.data.primary_qualification_id;
  if (!qualificationId) return failure("invalid", "Choose your qualification first.");

  const existing = new Set((current.data ?? []).map((r) => r.subject_id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));

  if (toRemove.length) {
    const exams = await ctx.supabase
      .from("examination_dates")
      .delete()
      .eq("student_id", ctx.studentId)
      .in("subject_id", toRemove);
    if (exams.error) return fromDatabaseError(exams.error);
    const removed = await ctx.supabase
      .from("student_subjects")
      .delete()
      .eq("student_id", ctx.studentId)
      .in("subject_id", toRemove);
    if (removed.error) return fromDatabaseError(removed.error);
  }
  if (toAdd.length) {
    const added = await ctx.supabase.from("student_subjects").upsert(
      toAdd.map((subjectId) => ({
        student_id: ctx.studentId,
        subject_id: subjectId,
        qualification_id: qualificationId,
      })),
      { onConflict: "student_id,subject_id", ignoreDuplicates: true },
    );
    if (added.error) return fromDatabaseError(added.error);
  }

  await advance(ctx, mode.advanceTo);
  if (!mode.advanceTo) refresh();
  return success();
}

/** Sets the qualification and exam board for each subject. */
export async function saveBoards(input: unknown, mode: Mode = {}): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = boardsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const ref = await getReferenceData().catch(() => null);
  if (!ref) return failure("unavailable");

  const current = await ctx.supabase
    .from("student_subjects")
    .select("subject_id, qualification_id, current_grade, target_grade")
    .eq("student_id", ctx.studentId);
  if (current.error) return fromDatabaseError(current.error);
  const rows = new Map((current.data ?? []).map((r) => [r.subject_id, r]));

  const errors: Record<string, string> = {};
  for (const e of parsed.data.entries) {
    if (!rows.has(e.subjectId)) errors[e.subjectId] = "This subject isn't on your list.";
    else if (!ref.qualifications.some((q) => q.id === e.qualificationId))
      errors[e.subjectId] = "Choose a qualification.";
    else if (e.examBoardId && !(ref.boardsByQualification[e.qualificationId] ?? []).includes(e.examBoardId))
      errors[e.subjectId] = "That board doesn't offer this qualification.";
  }
  if (Object.keys(errors).length) return failure("invalid", undefined, errors);

  const results = await Promise.all(
    parsed.data.entries.map((e) => {
      const row = rows.get(e.subjectId)!;
      const level = ref.qualifications.find((q) => q.id === e.qualificationId)!.level;
      return ctx.supabase
        .from("student_subjects")
        .update({
          qualification_id: e.qualificationId,
          exam_board_id: e.examBoardId,
          // Grades from a different qualification scale no longer make sense.
          current_grade: gradeIsValid(level, row.current_grade) ? row.current_grade : null,
          target_grade: gradeIsValid(level, row.target_grade) ? row.target_grade : null,
        })
        .eq("student_id", ctx.studentId)
        .eq("subject_id", e.subjectId);
    }),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fromDatabaseError(failed.error);

  // Exams follow their subject's qualification and board.
  await Promise.all(
    parsed.data.entries.map((e) =>
      ctx.supabase
        .from("examination_dates")
        .update({ qualification_id: e.qualificationId, exam_board_id: e.examBoardId })
        .eq("student_id", ctx.studentId)
        .eq("subject_id", e.subjectId),
    ),
  );

  await advance(ctx, mode.advanceTo);
  if (!mode.advanceTo) refresh();
  return success();
}

export async function saveGoals(input: unknown, mode: Mode = {}): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const ref = await getReferenceData().catch(() => null);
  if (!ref) return failure("unavailable");
  const current = await ctx.supabase
    .from("student_subjects")
    .select("subject_id, qualification_id")
    .eq("student_id", ctx.studentId);
  if (current.error) return fromDatabaseError(current.error);
  const levelOf = new Map(
    (current.data ?? []).map((r) => [r.subject_id, ref.qualifications.find((q) => q.id === r.qualification_id)?.level]),
  );

  const errors: Record<string, string> = {};
  for (const e of parsed.data.entries) {
    const level = levelOf.get(e.subjectId);
    if (!level) errors[e.subjectId] = "This subject isn't on your list.";
    else if (!gradeIsValid(level, e.currentGrade) || !gradeIsValid(level, e.targetGrade))
      errors[e.subjectId] = "Choose a grade from the list.";
  }
  if (Object.keys(errors).length) return failure("invalid", undefined, errors);

  const results = await Promise.all([
    ...parsed.data.entries.map((e) =>
      ctx.supabase
        .from("student_subjects")
        .update({ current_grade: e.currentGrade, target_grade: e.targetGrade, confidence: e.confidence })
        .eq("student_id", ctx.studentId)
        .eq("subject_id", e.subjectId),
    ),
    ctx.supabase
      .from("student_profiles")
      .update({ academic_goals: parsed.data.academicGoals })
      .eq("profile_id", ctx.studentId),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) return fromDatabaseError(failed.error);

  await advance(ctx, mode.advanceTo);
  if (!mode.advanceTo) refresh();
  return success();
}

/** Adds or updates one exam. Qualification and board come from the subject. */
export async function saveExam(input: unknown): Promise<ActionResult<ExamRow>> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = examSchema(londonToday()).safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;

  const subject = await ctx.supabase
    .from("student_subjects")
    .select("qualification_id, exam_board_id")
    .eq("student_id", ctx.studentId)
    .eq("subject_id", v.subjectId)
    .maybeSingle();
  if (subject.error) return fromDatabaseError(subject.error);
  if (!subject.data)
    return failure("invalid", "Add this subject to your list first.", { subjectId: "Choose one of your subjects." });

  const values = {
    subject_id: v.subjectId,
    qualification_id: subject.data.qualification_id,
    exam_board_id: subject.data.exam_board_id,
    exam_date: v.examDate,
    notes: v.notes,
  };

  const query = v.id
    ? ctx.supabase.from("examination_dates").update(values).eq("id", v.id).eq("student_id", ctx.studentId)
    : ctx.supabase.from("examination_dates").insert({ ...values, student_id: ctx.studentId });
  const { data, error } = await query
    .select("id, subject_id, qualification_id, exam_board_id, exam_date, notes")
    .maybeSingle();

  if (error) {
    const f = fromDatabaseError(error);
    return f.error === "duplicate" ? failure("duplicate", "You've already added this exam.") : f;
  }
  if (!data) return failure("not_found");

  return success({
    id: data.id,
    subjectId: data.subject_id,
    qualificationId: data.qualification_id,
    examBoardId: data.exam_board_id,
    examDate: data.exam_date,
    notes: data.notes,
  });
}

export async function removeExam(examId: unknown): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const id = z.uuid().safeParse(examId);
  if (!id.success) return failure("invalid");

  const { error, count } = await ctx.supabase
    .from("examination_dates")
    .delete({ count: "exact" })
    .eq("id", id.data)
    .eq("student_id", ctx.studentId);
  if (error) return fromDatabaseError(error);
  if (!count) return failure("not_found");
  return success();
}

export async function savePreferences(input: unknown, mode: Mode = {}): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const { error } = await ctx.supabase
    .from("student_profiles")
    .update({ learning_preferences: parsed.data.preferences })
    .eq("profile_id", ctx.studentId);
  if (error) return fromDatabaseError(error);

  await advance(ctx, mode.advanceTo);
  return success();
}

/** Records a step the student moved to, so they resume there on any device. */
export async function recordStep(step: unknown): Promise<void> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return;
  const parsed = z.number().int().min(1).max(8).safeParse(step);
  if (parsed.success) await advance(ctx, parsed.data);
}

/**
 * Finishes onboarding. The database function re-checks every required answer
 * and is the only thing allowed to mark onboarding complete.
 */
export async function completeStudentOnboarding(): Promise<ActionResult> {
  const ctx = await studentContext();
  if (isFailure(ctx)) return ctx;
  const { error } = await ctx.supabase.rpc("complete_student_onboarding");
  if (error) return fromDatabaseError(error);
  return success();
}
