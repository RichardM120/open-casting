import { confirmGuardianSubmission } from "@/lib/actions";
import { Checkbox } from "./ui";
import { SubmitButton } from "./submit-button";

/**
 * The two things a guardian does: say they are the guardian, and confirm.
 *
 * It is a form rather than a link, so opening the email — or a scanner opening
 * it for them — confirms nothing. The tick is the statement being recorded;
 * the button is the act.
 */
export function ConfirmGuardian({ token, name }: { token: string; name: string }) {
  return (
    <form action={confirmGuardianSubmission} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Checkbox
        name="guardian"
        required
        label={`I am ${name}'s parent or legal guardian, and I agree to this submission.`}
      />
      <div>
        <SubmitButton>Confirm this submission</SubmitButton>
      </div>
    </form>
  );
}
