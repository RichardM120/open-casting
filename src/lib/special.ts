import "server-only";

import { createHash } from "node:crypto";

import type { SessionUser } from "./auth";
import { query } from "./db";
import type { Runner } from "./retention";
import {
  SPECIAL_KINDS,
  SPECIAL_RETENTION_DAYS,
  type Role,
  type SpecialAnswer,
  type SpecialKind,
  type SpecialQuestion,
} from "./types";

/**
 * Answers to a role's question about a protected characteristic. They are
 * special category data, so they live in their own table with their own
 * consent record, are read by the account that posted the role and an
 * administrator and nobody else, and are deleted on a shorter clock than the
 * submission they belong to.
 */

/** What a characteristic is called in the second person. */
export function aboutFor(kind: SpecialKind): string {
  return SPECIAL_KINDS.find((option) => option.key === kind)?.about ?? "a protected characteristic";
}

/** The sentence an applicant ticks, exactly as it read: it is stored with the answer. */
export function consentTextFor(question: SpecialQuestion, company: string): string {
  return (
    `I consent to ${company} and Open Casting processing my answer about ${aboutFor(question.kind)} ` +
    "for this casting decision and nothing else. It is special category data under UK GDPR. " +
    "I can withdraw this consent at any time by asking, and the answer is deleted " +
    `${SPECIAL_RETENTION_DAYS} days after casting closes.`
  );
}

export function hashConsent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Who may read an answer: the account that posted the role, and an administrator. */
export function maySeeSpecial(role: Pick<Role, "ownerId">, viewer: SessionUser): boolean {
  return viewer.role === "admin" || (role.ownerId !== null && role.ownerId === viewer.id);
}

export async function recordSpecialAnswer(input: {
  submissionId: string;
  roleId: string;
  sessionId: string;
  kind: SpecialKind;
  answer: string;
  consentText: string;
}): Promise<void> {
  await query(
    `INSERT INTO special_answers
       (submission_id, role_id, session_id, kind, answer, consent_text, consent_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.submissionId,
      input.roleId,
      input.sessionId,
      input.kind,
      input.answer,
      input.consentText,
      hashConsent(input.consentText),
    ],
  );
}

/** A submission whose answer could not be recorded is not kept half-made. */
export async function forgetSubmission(id: string): Promise<void> {
  await query("DELETE FROM submissions WHERE id = $1", [id]);
}

type Row = {
  submission_id: string;
  kind: string;
  answer: string;
  consent_text: string;
  consent_hash: string;
  consented_at: Date;
};

/** The answers under a role, by submission, for a viewer allowed to read them; empty otherwise. */
export async function specialAnswersFor(
  role: Pick<Role, "id" | "ownerId">,
  viewer: SessionUser,
): Promise<Map<string, SpecialAnswer>> {
  const answers = new Map<string, SpecialAnswer>();
  if (!maySeeSpecial(role, viewer)) return answers;
  const rows = await query<Row>(
    `SELECT submission_id, kind, answer, consent_text, consent_hash, consented_at
       FROM special_answers WHERE role_id = $1`,
    [role.id],
  );
  for (const row of rows) {
    answers.set(row.submission_id, {
      submissionId: row.submission_id,
      kind: (SPECIAL_KINDS.find((option) => option.key === row.kind)?.key ?? "other") as SpecialKind,
      answer: row.answer,
      consentText: row.consent_text,
      consentHash: row.consent_hash,
      consentedAt: row.consented_at.toISOString(),
    });
  }
  return answers;
}

/** Which submissions under a role carry an answer, without the answers: what a producer sees. */
export async function submissionsWithSpecialAnswers(roleId: string): Promise<Set<string>> {
  const rows = await query<{ submission_id: string }>(
    "SELECT submission_id FROM special_answers WHERE role_id = $1",
    [roleId],
  );
  return new Set(rows.map((row) => row.submission_id));
}

/**
 * Deletes every answer under a casting call that closed more than the
 * special retention period ago. Casting closing is the clock, not the
 * production finishing: the answer was needed to decide, and the decision
 * is made by then.
 */
export async function purgeSpecialAnswers(run: Runner = query): Promise<number> {
  const rows = await run<{ submission_id: string }>(
    `DELETE FROM special_answers
      WHERE session_id IN (
        SELECT id FROM sessions_casting
         WHERE COALESCE(closed_at, closes_at) < now() - interval '${SPECIAL_RETENTION_DAYS} days'
      )
      RETURNING submission_id`,
  );
  return rows.length;
}
