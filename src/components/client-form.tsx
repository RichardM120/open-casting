"use client";

import { useActionState } from "react";

import { createClientRecord, editClientRecord } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { BILLING_PERIODS, BILLING_PERIOD_KEYS, TIERS, TIER_KEYS, type Client } from "@/lib/types";

import { DateTimeField } from "./date-time-field";
import { useErrorFocus } from "./use-error-focus";
import { ButtonLink, ErrorSummary, Field, Input, RequiredKey, Select, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

const LABELS: Record<string, string> = {
  name: "Client",
  contactName: "Contact",
  contactEmail: "Contact email",
  contactPhone: "Phone",
  billingEmail: "Where the invoice goes",
  billingReference: "Purchase order or reference",
  vatNumber: "VAT number",
  paymentTermsDays: "Payment terms",
  ratePence: "What they pay",
  billingPeriod: "How often",
  address: "Address",
  notes: "Notes",
  tier: "Plan",
  maxSessions: "Casting calls included",
  maxRolesPerSession: "Roles per casting call",
  accessUntil: "Access until",
};

/** Pence as the pounds a person types: 45000 as "450", 45050 as "450.50". */
function pounds(pence: number | null): string {
  if (pence === null) return "";
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

/** One form for taking on a client and for changing what they are on. */
export function ClientForm({ client }: { client?: Client }) {
  const [state, formAction, pending] = useActionState(
    client ? editClientRecord : createClientRecord,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  const values: Record<string, string> =
    state.status === "idle" && client
      ? {
          name: client.name,
          contactName: client.contactName,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
          billingEmail: client.billingEmail,
          billingReference: client.billingReference,
          vatNumber: client.vatNumber,
          paymentTermsDays:
            client.paymentTermsDays === null ? "" : String(client.paymentTermsDays),
          ratePence: pounds(client.ratePence),
          billingPeriod: client.billingPeriod,
          address: client.address,
          notes: client.notes,
          tier: client.tier ?? "",
          maxSessions: client.maxSessions === null ? "" : String(client.maxSessions),
          maxRolesPerSession:
            client.maxRolesPerSession === null ? "" : String(client.maxRolesPerSession),
          accessUntil: client.accessUntil ?? "",
        }
      : submitted;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
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
        <legend className="mb-2 text-lg font-semibold tracking-tight">The company</legend>
        <p className="text-sm text-muted">
          The name their accounts sign in under. Changing it renames every account with them.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Client" htmlFor="name" error={errors.name} className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              placeholder="CW Casting Ltd"
              defaultValue={values.name ?? ""}
              required
            />
          </Field>
          <Field label="Contact" htmlFor="contactName" error={errors.contactName}>
            <Input id="contactName" name="contactName" defaultValue={values.contactName ?? ""} />
          </Field>
          <Field label="Phone" htmlFor="contactPhone" error={errors.contactPhone}>
            <Input id="contactPhone" name="contactPhone" defaultValue={values.contactPhone ?? ""} />
          </Field>
          <Field label="Contact email" htmlFor="contactEmail" error={errors.contactEmail}>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={values.contactEmail ?? ""}
            />
          </Field>
          <Field label="Address" htmlFor="address" error={errors.address}>
            <Input id="address" name="address" defaultValue={values.address ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">Invoicing</legend>
        <p className="text-sm text-muted">
          Where invoices go, what has to be on them, and how long they have to pay.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Where the invoice goes" htmlFor="billingEmail" error={errors.billingEmail}>
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
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">What they bought</legend>
        <p className="max-w-prose text-sm text-muted">
          Every account under this client inherits these. Leave a ceiling blank for no limit,
          and the date blank for no end.
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
            <Select id="tier" name="tier" defaultValue={values.tier ?? ""}>
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
          <Field
            label="Notes"
            htmlFor="notes"
            hint="Anything you need to remember about the arrangement."
            error={errors.notes}
            className="sm:col-span-2"
          >
            <Textarea id="notes" name="notes" rows={3} defaultValue={values.notes ?? ""} />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton disabled={pending}>
          {pending ? "Saving..." : client ? "Save the client" : "Take on the client"}
        </SubmitButton>
        <ButtonLink href="/admin/clients" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
