"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SUBMISSION_TERMS } from "@/content/legal";

import { record, describeChanges, describeSessionChanges } from "./activity";
import { requireUser, type SessionUser } from "./auth";
import { checkStore, deleteMedia, isSubmissionMediaUrl } from "./blob";
import { UNIQUE_VIOLATION } from "./db";
import { emailConfigured, sendEmail } from "./email";
import { exportFilename, submissionsWorkbook } from "./export";
import { purgeDate } from "./retention";
import {
  createClient,
  deleteClient,
  getClient,
  setClientSuspended,
  updateClient,
} from "./clients";
import {
  createSession,
  deleteSessionAsAdmin,
  getSession,
  getVisibleSession,
  publishSession,
  setSessionClosed,
  updateSession,
} from "./sessions";
import { formatDate, formatDateTime, isOpen, notYetOpen, roleWindow } from "./format";
import { clientAddress, overLimit } from "./rate-limit";
import { submittedValues, type FormState } from "./form-state";
import {
  createRole,
  deleteRoleAsAdmin,
  getRole,
  getVisibleRole,
  listSessionRoles,
  setRoleClosed,
  updateRole,
} from "./roles";
import {
  DuplicateSubmissionError,
  createSubmission,
  setSubmissionStatus,
  submissionContext,
  mediaUrlsForRole,
  mediaUrlsForSession,
  listSessionSubmissions,
} from "./submissions";
import {
  ADULT_AGE,
  ROLE_LABELS,
  SUBMISSION_STATUSES,
  type SubmissionStatus,
  type Tier,
} from "./types";
import {
  EmailTakenError,
  accountUsage,
  createUser,
  findAccount,
  setAccountSuspended,
  renameClientAccounts,
} from "./users";
import { generatePassword } from "./password";
import {
  clientSchema,
  fieldErrors,
  newAccountSchema,
  roleSchema,
  sessionSchema,
  submissionSchema,
  type FieldErrors,
} from "./validation";

function invalid(
  errors: FieldErrors,
  message: string,
  formData: FormData,
): FormState {
  return { status: "error", message, errors, values: submittedValues(formData) };
}

/**
 * Roles and submissions surface on almost every page (counts on the dashboard,
 * cards on the production pages, the activity trail), so any write invalidates
 * the lot rather than trying to enumerate which pages moved.
 */
function revalidateEverything(): void {
  revalidatePath("/", "layout");
}

export async function submitApplication(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const roleId = String(formData.get("roleId") ?? "");
  const role = await getRole(roleId);

  if (!role) {
    return invalid({}, "That role is no longer listed.", formData);
  }
  const window = roleWindow(role);
  if (!isOpen(window)) {
    return invalid(
      {},
      notYetOpen(window)
        ? `Submissions for ${role.session.name} do not open until ${formatDateTime(role.session.opensAt)}.`
        : "This role is no longer accepting submissions.",
      formData,
    );
  }

  if (await overLimit("submission", await clientAddress())) {
    return invalid(
      {},
      "That is a lot of submissions from one place in a short time. Try again in an hour.",
      formData,
    );
  }

  const parsed = submissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const {
    acceptTerms,
    acceptSubmissionTerms,
    guardianName,
    guardianEmail,
    guardianConsent,
    ...submission
  } = parsed.data;

  // The platform's own terms apply to every submission, whether or not the
  // casting director set any of their own.
  if (!acceptSubmissionTerms) {
    return invalid(
      { acceptSubmissionTerms: "Please accept the Terms of Submission to continue" },
      "You need to accept the Terms of Submission and Acceptable Use Policy before submitting.",
      formData,
    );
  }

  // A minor's submission has to come from a parent or legal guardian. Decided
  // from the age given, not from whether the form troubled to send the fields.
  const minor = submission.age < ADULT_AGE;
  if (minor) {
    const missing: FieldErrors = {};
    if (!guardianName || guardianName.length < 2) {
      missing.guardianName = "Enter the parent or guardian's full name";
    }
    if (!guardianEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardianEmail)) {
      missing.guardianEmail = "Enter the parent or guardian's email address";
    }
    if (!guardianConsent) {
      missing.guardianConsent =
        "Confirm you are the parent or legal guardian and consent to this submission";
    }
    if (Object.keys(missing).length > 0) {
      return invalid(
        missing,
        `This applicant is under ${ADULT_AGE}, so the submission has to be made by a parent or legal guardian.`,
        formData,
      );
    }
  }

  // Uploaded files come back as URLs. A form can post any string, so each is
  // checked against the store and the prefix the upload token was minted for,
  // before it is stored against anybody.
  const media = { photoUrl: null as string | null, videoUrl: null as string | null };
  for (const [field, kind] of [["photoUrl", "photo"], ["videoUrl", "video"]] as const) {
    const posted = String(formData.get(field) ?? "").trim();
    if (!posted) continue;
    if (!isSubmissionMediaUrl(posted, role.sessionId, roleId, kind)) {
      return invalid(
        { [field]: "That file did not upload properly. Please try again." },
        "One of the files did not upload properly. Please try again.",
        formData,
      );
    }
    media[field] = posted;
  }

  // The role decides whether terms must be accepted, not the form that was
  // posted. Otherwise dropping the checkbox from the request would skip it.
  if (role.disclaimer && !acceptTerms) {
    return invalid(
      { acceptTerms: "Please confirm you have read the terms for this role" },
      "You need to accept the terms for this role before submitting.",
      formData,
    );
  }

  try {
    await createSubmission({
      ...submission,
      // A child's contact is the adult responsible for them. It is also what
      // the one-submission-per-production rule keys on, so it has to be set.
      email: minor && guardianEmail ? guardianEmail : submission.email,
      roleId,
      sessionId: role.sessionId,
      // The wording is copied as it stands now, so editing the role later
      // cannot change what this person agreed to.
      acceptedTerms: role.disclaimer || null,
      acceptedAt: role.disclaimer ? new Date().toISOString() : null,
      // Recorded so it is possible to say afterwards exactly what was agreed.
      termsVersion: SUBMISSION_TERMS.version,
      guardianName: minor ? (guardianName ?? null) : null,
      guardianEmail: minor ? (guardianEmail ?? null) : null,
      guardianConsentAt: minor ? new Date().toISOString() : null,
      photoUrl: media.photoUrl,
      videoUrl: media.videoUrl,
    });
  } catch (error) {
    // The unique index is the authority here, so two simultaneous submissions
    // cannot both slip past a check-then-insert.
    if (error instanceof DuplicateSubmissionError) {
      return invalid(
        { email: "You have already submitted for this casting call" },
        `We already have a submission from that email address for ${role.session.name}. A casting call considers you once, not once per role.`,
        formData,
      );
    }
    throw error;
  }

  await record({
    action: "submission.received",
    actorId: null,
    actorName: submission.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
  });

  revalidateEverything();

  return {
    status: "success",
    message: `Thanks, ${submission.name.split(" ")[0]}. Your submission is with ${role.castingDirector}.`,
    errors: {},
    values: {},
  };
}

export async function postRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Checked here as well as on the page: the page redirect is for the person,
  // this is what actually stops an unauthenticated request writing a role.
  const user = await requireUser("/dashboard/roles/new");

  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const { sessionId, ...fields } = parsed.data;
  const session = await getVisibleSession(sessionId, user);
  if (!session) {
    return invalid(
      { sessionId: "That casting call is not one of yours" },
      "Choose a casting call you can post into.",
      formData,
    );
  }

  if (user.maxRolesPerSession !== null) {
    const existing = await listSessionRoles(session.id);
    if (existing.length >= user.maxRolesPerSession) {
      return invalid(
        {},
        `Your account covers ${user.maxRolesPerSession} ${user.maxRolesPerSession === 1 ? "role" : "roles"} per casting call, and ${session.name} has that many. Ask the administrator to extend it.`,
        formData,
      );
    }
  }

  const role = await createRole(fields, session, user);
  await record({
    action: "role.posted",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
  });
  revalidateEverything();
  redirect(`/dashboard/roles/${role.id}?posted=1`);
}

function isSubmissionStatus(value: string): value is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

export async function updateSubmissionStatus(formData: FormData): Promise<void> {
  const user = await requireUser("/dashboard");
  const id = String(formData.get("submissionId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isSubmissionStatus(status)) return;

  // Silently a no-op when the submission hangs off a role this account cannot see.
  const changed = await setSubmissionStatus(id, status, user);
  if (changed) {
    const context = await submissionContext(id);
    await record({
      action: "submission.status",
      actorId: user.id,
      actorName: user.name,
      role: context ? { id: context.roleId, title: context.roleTitle } : undefined,
      ownerId: context?.ownerId ?? null,
      company: context?.company ?? null,
      detail: `${context?.name ?? "a submission"} → ${status}`,
    });
  }
  revalidateEverything();
}

/**
 * The casting call's submissions, as a spreadsheet, to the signed-in account's
 * own address and nowhere else: a file of applicants' details goes to the
 * person who may already see them, not to whoever types an address. Without a
 * mail provider it says so rather than pretending; the download always works.
 */
export async function emailSubmissionsSheet(formData: FormData): Promise<void> {
  const id = String(formData.get("sessionId") ?? "");
  const user = await requireUser(`/dashboard/sessions/${id}`);
  const session = await getVisibleSession(id, user);
  if (!session) redirect("/dashboard");

  if (!emailConfigured()) redirect(`/dashboard/sessions/${id}?emailed=0`);

  const submissions = await listSessionSubmissions(id);
  const roles = new Set(submissions.map((submission) => submission.roleId)).size;
  const file = await submissionsWorkbook(session, submissions);
  const count = `${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"}`;

  const delivery = await sendEmail({
    to: user.email,
    subject: `Submissions for ${session.name}`,
    text: [
      `Attached: the submissions for ${session.name}, as of ${formatDateTime(new Date().toISOString())}.`,
      "",
      `${count} across ${roles} ${roles === 1 ? "role" : "roles"}. Each row is one applicant: the role they went for, their status, their contact details and their cover note.`,
      "",
      `This file holds applicants' personal details. Keep it only as long as you need it. On Open Casting their details are destroyed on ${formatDate(purgeDate(session.productionEndsAt))}; delete your own copies when you no longer need them.`,
    ].join("\n"),
    attachments: [{ filename: exportFilename(session), content: file.toString("base64") }],
  });

  if (!delivery.delivered) redirect(`/dashboard/sessions/${id}?emailed=0`);

  await record({
    action: "data.exported",
    actorId: user.id,
    actorName: user.name,
    ownerId: session.ownerId,
    company: session.company,
    detail: `${session.name} · ${count} emailed to ${user.email}`,
  });
  redirect(`/dashboard/sessions/${id}?emailed=1`);
}

/* ------------------------------------------------------------ moderation -- */

export async function editRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("roleId") ?? "");
  const user = await requireUser(`/dashboard/roles/${id}/edit`);

  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const before = await getVisibleRole(id, user);

  // `sessionId` is part of the schema so posting can pick a production. A role
  // does not move between productions afterwards, so `updateRole` ignores it:
  // moving one would change its dates and orphan the submissions already made
  // under it.
  const role = await updateRole(id, parsed.data, user);
  if (!role) {
    return invalid({}, "That role is no longer yours to edit.", formData);
  }

  await record({
    action: "role.edited",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
    detail: before ? describeChanges(before, role) : "",
  });

  revalidateEverything();
  redirect(`/dashboard/roles/${role.id}?saved=1`);
}

/** Closes a role early, or puts it back. Anyone who can see it can do this. */
export async function toggleRoleClosed(formData: FormData): Promise<void> {
  const id = String(formData.get("roleId") ?? "");
  const closed = formData.get("closed") === "1";
  const user = await requireUser(`/dashboard/roles/${id}`);

  if (!id) return;

  const role = await getVisibleRole(id, user);
  if (!role || !(await setRoleClosed(id, closed, user))) return;

  await record({
    action: closed ? "role.closed" : "role.reopened",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
  });
  revalidateEverything();
}

/**
 * Removes a role and every submission made to it. Admin only, and the
 * confirmation has to be ticked: this destroys other people's data.
 */
export async function removeRole(formData: FormData): Promise<void> {
  const id = String(formData.get("roleId") ?? "");
  const user = await requireUser("/dashboard");

  if (user.role !== "admin" || formData.get("confirm") !== "on" || !id) return;

  // Described before it goes: afterwards there is nothing left to describe. The
  // entry survives the delete because role_id is ON DELETE SET NULL and the
  // title, owner and company are copied onto it.
  const role = await getRole(id);
  if (!role) return;

  await record({
    action: "role.removed",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
    detail: `${role.production} · ${role.company}`,
  });

  const roleMedia = await mediaUrlsForRole(id);

  await deleteRoleAsAdmin(id);

  await deleteMedia(roleMedia);
  revalidateEverything();
  redirect(`/dashboard/sessions/${role.sessionId}?removed=1`);
}

/**
 * Creates an account for someone. Admin only. This is the only way anyone gets
 * one, so the check here is the whole of the registration policy.
 *
 * The password is generated rather than chosen, and returned in the action's
 * result so it can be read once and handed over. It is never stored in the
 * clear and cannot be retrieved afterwards; if it is lost, make another account
 * or reset it.
 */
export async function createAccount(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/admin/accounts");
  if (user.role !== "admin") {
    return invalid({}, "Only the administrator can create accounts.", formData);
  }

  const parsed = newAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  // The account inherits its client's name and everything the client bought,
  // so there is nothing to set per account beyond who they are.
  const client = await getClient(parsed.data.clientId);
  if (!client) {
    return invalid(
      { clientId: "Choose one of your clients" },
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const password = generatePassword();
  const { clientId, ...profile } = parsed.data;

  let created;
  try {
    created = await createUser({
      ...profile,
      company: client.name,
      clientId,
      password,
    });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return invalid(
        { email: "An account with that email already exists" },
        "That email already has an account.",
        formData,
      );
    }
    throw error;
  }

  await record({
    action: "account.created",
    actorId: user.id,
    actorName: user.name,
    detail: `${created.name} · ${created.company} · ${ROLE_LABELS[created.role]}`,
  });

  revalidateEverything();
  return {
    status: "success",
    message: `Account created for ${created.name}.`,
    errors: {},
    values: {},
    data: { email: created.email, password },
  };
}

/** Suspends or restores an account. Admin only. */
export async function toggleAccountSuspended(formData: FormData): Promise<void> {
  const id = String(formData.get("accountId") ?? "");
  const suspended = formData.get("suspended") === "1";
  const user = await requireUser("/admin/accounts");

  // An admin locking themselves out would leave nobody able to undo it.
  if (user.role !== "admin" || !id || id === user.id) return;

  const account = await findAccount(id);
  if (!account || !(await setAccountSuspended(id, suspended))) return;

  // No role, owner or company: account events stay visible to admins only.
  await record({
    action: suspended ? "account.suspended" : "account.restored",
    actorId: user.id,
    actorName: user.name,
    detail: `${account.name} · ${account.company}`,
  });
  revalidateEverything();
}

/* -------------------------------------------------------------- clients -- */

/** Everything a client action shares: only the owner gets to run one. */
async function requireOwner(back: string): Promise<SessionUser | FormState> {
  const user = await requireUser(back);
  if (user.role !== "admin") {
    return { status: "error", message: "Only the administrator manages clients.", errors: {}, values: {} };
  }
  return user;
}

/** The owner proving the file store works from this deployment. */
export async function testFileStore(): Promise<void> {
  const user = await requireOwner("/admin");
  if ("status" in user) redirect("/admin");
  const result = await checkStore();
  redirect(
    result.ok
      ? `/admin?store=ok&ms=${result.ms}`
      : `/admin?store=failed&why=${encodeURIComponent(result.error.slice(0, 200))}`,
  );
}

export async function createClientRecord(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireOwner("/admin/clients/new");
  if ("status" in gate) return gate;

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  let client;
  try {
    client = await createClient({ ...parsed.data, tier: (parsed.data.tier as Tier | undefined) ?? null });
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return invalid(
        { name: "There is already a client with that name" },
        "Check the highlighted fields and try again.",
        formData,
      );
    }
    throw error;
  }

  await record({
    action: "client.created",
    actorId: gate.id,
    actorName: gate.name,
    ownerId: null,
    company: client.name,
    detail: client.name,
  });

  revalidateEverything();
  redirect(`/admin/clients/${client.id}?created=1`);
}

export async function editClientRecord(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("clientId") ?? "");
  const gate = await requireOwner(`/admin/clients/${id}`);
  if ("status" in gate) return gate;

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  let client;
  try {
    client = await updateClient(id, { ...parsed.data, tier: (parsed.data.tier as Tier | undefined) ?? null });
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return invalid(
        { name: "There is already a client with that name" },
        "Check the highlighted fields and try again.",
        formData,
      );
    }
    throw error;
  }
  if (!client) return invalid({}, "That client no longer exists.", formData);

  // The account rows carry the client's name, because that is what producer
  // visibility matches on, so a rename has to reach them or a producer would
  // stop seeing their colleagues' work.
  await renameClientAccounts(id, client.name);

  await record({
    action: "client.edited",
    actorId: gate.id,
    actorName: gate.name,
    ownerId: null,
    company: client.name,
    detail: client.name,
  });

  revalidateEverything();
  redirect(`/admin/clients/${client.id}?saved=1`);
}

/** Stops or restarts a whole client, and everyone signed in under it. */
export async function toggleClientSuspended(formData: FormData): Promise<void> {
  const id = String(formData.get("clientId") ?? "");
  const user = await requireUser("/admin/clients");
  if (user.role !== "admin" || !id) redirect("/admin/clients");

  const suspend = formData.get("suspend") === "on";
  const client = await getClient(id);
  if (!client) redirect("/admin/clients");

  await setClientSuspended(id, suspend);
  await record({
    action: suspend ? "client.suspended" : "client.restored",
    actorId: user.id,
    actorName: user.name,
    ownerId: null,
    company: client.name,
    detail: client.name,
  });

  revalidateEverything();
  redirect(`/admin/clients/${id}?${suspend ? "suspended" : "restored"}=1`);
}

export async function removeClient(formData: FormData): Promise<void> {
  const id = String(formData.get("clientId") ?? "");
  const user = await requireUser("/admin/clients");
  if (user.role !== "admin" || formData.get("confirm") !== "on" || !id) {
    redirect("/admin/clients");
  }

  const client = await getClient(id);
  if (!client) redirect("/admin/clients");

  const outcome = await deleteClient(id);
  if (outcome === "in-use") redirect(`/admin/clients/${id}?inuse=1`);
  if (outcome === "not-found") redirect("/admin/clients");

  await record({
    action: "client.removed",
    actorId: user.id,
    actorName: user.name,
    ownerId: null,
    company: client.name,
    detail: client.name,
  });

  revalidateEverything();
  redirect("/admin/clients?removed=1");
}

/* ---------------------------------------------------------- productions -- */

/**
 * Opens a production. The production owns the live dates, so this is the first
 * thing a casting director does; roles are posted into it afterwards.
 */
export async function createCastingSession(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/dashboard/sessions/new");

  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  // The ceiling the administrator sold them. Checked here rather than in the
  // form, because the form is not what decides it.
  if (user.maxSessions !== null) {
    const { sessions } = await accountUsage(user.id);
    if (sessions >= user.maxSessions) {
      return invalid(
        {},
        `Your account covers ${user.maxSessions} ${user.maxSessions === 1 ? "production" : "productions"} and you have used all of them. Ask the administrator to extend it.`,
        formData,
      );
    }
  }

  const session = await createSession(parsed.data, user.id, user.company, user.clientId);
  await record({
    action: "session.created",
    actorId: user.id,
    actorName: user.name,
    ownerId: session.ownerId,
    company: session.company,
    detail: `${session.name} · ${formatDateTime(session.opensAt)} to ${formatDateTime(session.closesAt)}`,
  });

  revalidateEverything();
  redirect(`/dashboard/sessions/${session.id}?created=1`);
}

export async function editCastingSession(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("sessionId") ?? "");
  const user = await requireUser(`/dashboard/sessions/${id}`);

  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const before = await getVisibleSession(id, user);

  // Returns null when the production is not one this account may touch.
  const session = await updateSession(id, parsed.data, user);
  if (!session) {
    return invalid({}, "That casting call is no longer yours to edit.", formData);
  }

  await record({
    action: "session.edited",
    actorId: user.id,
    actorName: user.name,
    ownerId: session.ownerId,
    company: session.company,
    detail: `${session.name}: ${before ? describeSessionChanges(before, session) : "edited"}`,
  });

  revalidateEverything();
  redirect(`/dashboard/sessions/${session.id}?saved=1`);
}

/**
 * Publishes a production, which is the moment its link starts working.
 *
 * Refuses an empty production: a link that opens on nothing is worse than no
 * link, and this is the last point at which that is cheap to catch.
 */
export async function publishCastingSession(formData: FormData): Promise<void> {
  const id = String(formData.get("sessionId") ?? "");
  const user = await requireUser(`/dashboard/sessions/${id}`);
  if (!id) return;

  const session = await getVisibleSession(id, user);
  if (!session || session.publishedAt) return;

  const roles = await listSessionRoles(id);
  if (roles.length === 0) {
    redirect(`/dashboard/sessions/${id}?error=empty`);
  }

  const published = await publishSession(id, user);
  if (!published) return;

  await record({
    action: "session.published",
    actorId: user.id,
    actorName: user.name,
    ownerId: published.ownerId,
    company: published.company,
    detail: `${published.name}: ${roles.length} ${roles.length === 1 ? "role" : "roles"}`,
  });
  revalidateEverything();
  redirect(`/dashboard/sessions/${id}?published=1`);
}

/**
 * Closes a production ahead of its closing time, or puts it back. Every role in
 * it stops accepting submissions at the same moment, which is the point of the
 * production owning the window.
 */
export async function toggleSessionClosed(formData: FormData): Promise<void> {
  const id = String(formData.get("sessionId") ?? "");
  const closed = formData.get("closed") === "1";
  const user = await requireUser(`/dashboard/sessions/${id}`);

  if (!id) return;

  const session = await getVisibleSession(id, user);
  if (!session || !(await setSessionClosed(id, closed, user))) return;

  await record({
    action: closed ? "session.closed" : "session.reopened",
    actorId: user.id,
    actorName: user.name,
    ownerId: session.ownerId,
    company: session.company,
    detail: session.name,
  });
  revalidateEverything();
}

/**
 * Removes a production, every role in it and every submission made to those
 * roles. Admin only, and the confirmation has to be ticked: this destroys other
 * people's data on a scale a single role does not.
 */
export async function removeSession(formData: FormData): Promise<void> {
  const id = String(formData.get("sessionId") ?? "");
  const user = await requireUser("/dashboard");

  if (user.role !== "admin" || formData.get("confirm") !== "on" || !id) return;

  // Described before it goes: afterwards there is nothing left to describe.
  const session = await getSession(id);
  if (!session) return;

  await record({
    action: "session.removed",
    actorId: user.id,
    actorName: user.name,
    ownerId: session.ownerId,
    company: session.company,
    detail: `${session.name} · ${session.company}`,
  });

  const sessionMedia = await mediaUrlsForSession(id);

  await deleteSessionAsAdmin(id);

  await deleteMedia(sessionMedia);
  revalidateEverything();
  redirect("/dashboard?removed=1");
}
