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
  return (
    <form action={updateSubmissionStatus}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <StatusSelect status={status} />
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
      className="w-40 py-1.5 text-xs"
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
