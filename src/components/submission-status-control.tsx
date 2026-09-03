"use client";

import { useFormStatus } from "react-dom";

import { updateSubmissionStatus } from "@/lib/actions";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/types";

import { Select } from "./ui";

export function SubmissionStatusControl({
  submissionId,
  status,
}: {
  submissionId: string;
  status: SubmissionStatus;
}) {
  // Wide enough for "Shortlisted" in semibold and no wider: on a phone the
  // applicant's name and photo need the rest of the row.
  return (
    <form action={updateSubmissionStatus} className="w-36 shrink-0 sm:w-40">
      <input type="hidden" name="submissionId" value={submissionId} />
      <StatusSelect key={status} status={status} />
    </form>
  );
}

function StatusSelect({ status }: { status: SubmissionStatus }) {
  const { pending } = useFormStatus();

  return (
    <Select
      name="status"
      defaultValue={status}
      disabled={pending}
      aria-label="Submission status"
      className="py-2 pr-8! pl-3 text-[0.875rem] font-semibold sm:text-sm"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {SUBMISSION_STATUSES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}
