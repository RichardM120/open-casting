"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createAccount } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import {
  BILLING_PERIODS,
  BILLING_PERIOD_KEYS,
  ROLE_DESCRIPTIONS,
  SIGNUP_ROLES,
  TIERS,
  TIER_KEYS,
  type Client,
} from "@/lib/types";

import { DateTimeField } from "./date-time-field";
import { useErrorFocus } from "./use-error-focus";
import { ButtonLink, ErrorSummary, Field, Input, RequiredKey, Select, SectionHead } from "./ui";
import { SubmitButton } from "./submit-button";

const LABELS: Record<string, string> = {
  name: "Their name",
  clientId: "Client",
  email: "Email",
  role: "What they can see",
  billingEmail: "Where the invoice goes",
  billingReference: "Purchase order or reference",
  vatNumber: "VAT number",
  paymentTermsDays: "Payment terms",
  ratePence: "What they pay",
  billingPeriod: "How often",
  address: "Invoice address",
  tier: "Plan",
  maxSessions: "Casting calls included",
  maxRolesPerSession: "Roles per casting call",
  accessUntil: "Access until",
};

const ROLE_HEADINGS: Record<(typeof SIGNUP_ROLES)[number], string> = {
  director: "Casting director",
  producer: "Producer",
};

/** Pence as the pounds a person types: 45000 as "450", 45050 as "450.50". */
function pounds(pence: number | null): string {
  if (pence === null) return "";
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

/** What a client is on, as the form's fields read it. */
function moneyOf(client: Client | undefined): Record<string, string> {
  if (!client) return {};
  return {
    billingEmail: client.billingEmail,
    billingReference: client.billingReference,
    vatNumber: client.vatNumber,
    paymentTermsDays: client.paymentTermsDays === null ? "" : String(client.paymentTermsDays),
    ratePence: pounds(client.ratePence),
    billingPeriod: client.billingPeriod,
    address: client.address,
    tier: client.tier ?? "",
    maxSessions: client.maxSessions === null ? "" : String(client.maxSessions),
    maxRolesPerSession:
      client.maxRolesPerSession === null ? "" : String(client.maxRolesPerSession),
    accessUntil: client.accessUntil ?? "",
  };
}

/**
 * Setting an account up: the person, and the money behind them.
 *
 * The person is theirs; the invoicing and the billing are their client's, so
 * the fields fill with what that client is already on and changing one changes
 * it for every account under them. That is said on the page rather than left
 * to be discovered. The password is generated, not chosen, and shown once, so
 * it is worth something and nobody ends up sharing one.
 */
export function AccountSetupForm({ clients }: { clients: Client[] }) {
  const [state, formAction, pending] = useActionState(createAccount, IDLE_FORM_STATE);
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const chosen = clients.find((client) => client.id === clientId);
  // A refused save shows what was typed; otherwise the client's own figures,
  // which change under the fields as soon as another client is chosen.
  const values: Record<string, string> =
    state.status === "error" ? submitted : { ...moneyOf(chosen), role: "director" };
  // Remounted per client and per attempt, so a select shows the value it was
  // given rather than whatever React's reset left behind.
  const key = `${clientId}-${state.status}-${Object.keys(errors).length}`;

  const created = state.status === "success" ? state.data : undefined;

  if (created) {
    return (
      <div role="status" className="rounded-2xl border-2 border-positive bg-positive-soft p-5 sm:p-7">
        <p className="text-xs font-semibold tracking-[0.18em] text-positive uppercase">
          Account created
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{state.message}</h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          Send them these. The password is shown once and is not stored anywhere readable. If it
          is lost, the account needs a new one.
        </p>
        <dl className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-ink p-4 font-mono text-sm">
          <div className="flex flex-wrap gap-x-3">
            <dt className="text-faint">email</dt>
            <dd className="break-all">{created.email}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="text-faint">password</dt>
            <dd className="break-all text-brand select-all">{created.password}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          They will be asked to set their name and company on the way in, and can change them
          later.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/admin/accounts">Back to accounts</ButtonLink>
          <ButtonLink href="/admin/accounts/new" variant="secondary">
            Set up another
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {state.status === "error" ? (
        <>
          {state.message ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger"
            >
              {state.message}
            </p>
          ) : null}
          <ErrorSummary errors={errors} labels={LABELS} />
        </>
      ) : null}

      <RequiredKey />

      <fieldset className="rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">The person</legend>
        <p className="text-sm text-muted">
          Who is signing in, and how much of their client&rsquo;s work they see.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Their name" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" defaultValue={submitted.name ?? ""} required />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={submitted.email ?? ""}
              required
            />
          </Field>
          <Field
            label="Client"
            htmlFor="clientId"
            hint="The company paying. It sets what they may run, and it is who the invoice goes to."
            error={errors.clientId}
          >
            <Select
              id="clientId"
              name="clientId"
              value={clientId}
              onChange={(event) => setClientId(event.currentTarget.value)}
              required
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="What they can see"
            htmlFor="role"
            hint={ROLE_DESCRIPTIONS[(values.role as "director" | "producer") ?? "director"]}
            error={errors.role}
          >
            <Select
              key={`role-${key}`}
              id="role"
              name="role"
              defaultValue={values.role ?? "director"}
              required
            >
              {SIGNUP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_HEADINGS[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <div>
        <SectionHead
          title="The money"
          line={
            chosen
              ? `Invoiced to ${chosen.name}, so this is what every account under them is on. Filled in with what they are on now; change it here and it changes for the client.`
              : "Invoiced to the client, so this is what every account under them is on."
          }
        />
      </div>

      <fieldset className="rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">Invoicing</legend>
        <p className="text-sm text-muted">
          Where the invoice goes and what has to be on it. Anything you do not have yet can be
          left blank and filled in later.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Where the invoice goes"
            htmlFor="billingEmail"
            hint="Their accounts department, if that is not the person above."
            error={errors.billingEmail}
          >
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              defaultValue={values.billingEmail ?? ""}
            />
          </Field>
          <Field
            label="Purchase order or reference"
            htmlFor="billingReference"
            hint="Whatever they need quoted on it."
            error={errors.billingReference}
          >
            <Input
              id="billingReference"
              name="billingReference"
              defaultValue={values.billingReference ?? ""}
            />
          </Field>
          <Field label="VAT number" htmlFor="vatNumber" error={errors.vatNumber}>
            <Input
              id="vatNumber"
              name="vatNumber"
              placeholder="GB123456789"
              defaultValue={values.vatNumber ?? ""}
            />
          </Field>
          <Field
            label="Payment terms"
            htmlFor="paymentTermsDays"
            hint="Days from the invoice to the due date."
            error={errors.paymentTermsDays}
          >
            <Input
              id="paymentTermsDays"
              name="paymentTermsDays"
              type="number"
              min="0"
              max="365"
              placeholder="30"
              defaultValue={values.paymentTermsDays ?? ""}
            />
          </Field>
          <Field
            label="Invoice address"
            htmlFor="address"
            error={errors.address}
            className="sm:col-span-2"
          >
            <Input id="address" name="address" defaultValue={values.address ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">What they pay</legend>
        <p className="text-sm text-muted">
          The figure and the plan behind it. Leave a ceiling blank for no limit, and the date
          blank for no end.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="What they pay"
            htmlFor="ratePence"
            hint="In pounds, before VAT."
            error={errors.ratePence}
          >
            <Input
              id="ratePence"
              name="ratePence"
              inputMode="decimal"
              placeholder="450"
              defaultValue={values.ratePence ?? ""}
            />
          </Field>
          <Field label="How often" htmlFor="billingPeriod" error={errors.billingPeriod}>
            <Select
              key={`period-${key}`}
              id="billingPeriod"
              name="billingPeriod"
              defaultValue={values.billingPeriod ?? ""}
            >
              <option value="">Not set</option>
              {BILLING_PERIOD_KEYS.map((period) => (
                <option key={period} value={period}>
                  {BILLING_PERIODS[period].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan" htmlFor="tier" error={errors.tier}>
            <Select key={`tier-${key}`} id="tier" name="tier" defaultValue={values.tier ?? ""}>
              <option value="">No plan set</option>
              {TIER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {TIERS[key].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Access until" htmlFor="accessUntil" error={errors.accessUntil}>
            <DateTimeField
              key={`until-${key}`}
              id="accessUntil"
              name="accessUntil"
              label="Access until"
              mode="date"
              defaultValue={values.accessUntil ?? ""}
              align="end"
            />
          </Field>
          <Field
            label="Casting calls included"
            htmlFor="maxSessions"
            hint="Blank for no limit."
            error={errors.maxSessions}
          >
            <Input
              id="maxSessions"
              name="maxSessions"
              type="number"
              min="0"
              defaultValue={values.maxSessions ?? ""}
            />
          </Field>
          <Field
            label="Roles per casting call"
            htmlFor="maxRolesPerSession"
            hint="Blank for no limit."
            error={errors.maxRolesPerSession}
          >
            <Input
              id="maxRolesPerSession"
              name="maxRolesPerSession"
              type="number"
              min="0"
              defaultValue={values.maxRolesPerSession ?? ""}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <SubmitButton disabled={pending}>
          {pending ? "Creating…" : "Create the account"}
        </SubmitButton>
        <ButtonLink href="/admin/accounts" variant="ghost" size="sm">
          Cancel
        </ButtonLink>
        <p className="basis-full text-xs leading-relaxed text-muted">
          The password is generated and shown once on the next screen. Everything under The money
          is saved onto{" "}
          <Link
            href={chosen ? `/admin/clients/${chosen.id}` : "/admin/clients"}
            className="text-brand underline-offset-4 hover:underline"
          >
            {chosen ? chosen.name : "the client"}
          </Link>
          , and can be changed there at any time.
        </p>
      </div>
    </form>
  );
}
