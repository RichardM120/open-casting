import "server-only";

import ExcelJS from "exceljs";

import { formatDate, formatDateTime } from "./format";
import type { SessionSubmission } from "./submissions";
import type { CastingSession } from "./types";

/**
 * A casting call's submissions as a spreadsheet: one row per applicant, with
 * the role they went for, their status, their contact details and their cover
 * note, plus a second sheet saying which casting call it is and when it was
 * exported. Excel's own format rather than CSV, so a name with a comma in it
 * and a phone number with a leading zero both survive the trip.
 *
 * Every cell is written as text or a number, never as a formula, so a cover
 * note that happens to start with "=" is a cover note and not an instruction
 * to the spreadsheet.
 */

/** The file name: the casting call, then the day, so a later export sorts after an earlier one. */
export function exportFilename(session: CastingSession): string {
  const slug =
    session.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "casting-call";
  return `${slug}-submissions-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

export async function submissionsWorkbook(
  session: CastingSession,
  submissions: SessionSubmission[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Open Casting";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Submissions", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Role", key: "role", width: 28 },
    { header: "Applicant", key: "name", width: 26 },
    { header: "Status", key: "status", width: 14 },
    { header: "Age", key: "age", width: 6 },
    { header: "Location", key: "location", width: 22 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Submitted", key: "submittedAt", width: 20 },
    { header: "Showreel", key: "reelUrl", width: 36 },
    { header: "Profile", key: "profileUrl", width: 36 },
    { header: "Photo", key: "photo", width: 8 },
    { header: "Video", key: "video", width: 8 },
    { header: "Parent or guardian", key: "guardianName", width: 24 },
    { header: "Guardian email", key: "guardianEmail", width: 30 },
    { header: "Terms accepted", key: "acceptedAt", width: 20 },
    { header: "Cover note", key: "coverNote", width: 60 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const submission of submissions) {
    sheet.addRow({
      role: submission.roleTitle,
      name: submission.name,
      status: submission.status,
      age: submission.age,
      location: submission.location,
      email: submission.email,
      phone: submission.phone,
      submittedAt: formatDateTime(submission.submittedAt),
      reelUrl: submission.reelUrl,
      profileUrl: submission.profileUrl,
      photo: submission.photoUrl ? "Yes" : "",
      video: submission.videoUrl ? "Yes" : "",
      guardianName: submission.guardianName ?? "",
      guardianEmail: submission.guardianEmail ?? "",
      acceptedAt: submission.acceptedTerms
        ? formatDateTime(submission.acceptedAt ?? submission.submittedAt)
        : "",
      coverNote: submission.coverNote,
    });
  }
  sheet.autoFilter = { from: "A1", to: `P${submissions.length + 1}` };

  const about = workbook.addWorksheet("Casting call");
  about.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 60 },
  ];
  about.getRow(1).font = { bold: true };
  about.addRows([
    { field: "Casting call", value: session.name },
    { field: "Production type", value: session.productionType },
    { field: "Production company", value: session.productionCompany },
    { field: "Submissions open", value: formatDateTime(session.opensAt) },
    { field: "Submissions close", value: formatDateTime(session.closesAt) },
    { field: "Production finishes", value: formatDate(session.productionEndsAt) },
    { field: "Submissions", value: submissions.length },
    { field: "Exported", value: formatDateTime(new Date().toISOString()) },
  ]);

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
