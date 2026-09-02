"use client";

import { useActionState } from "react";

import { createClientRecord, editClientRecord } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { TIERS, TIER_KEYS, type Client } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, Select, Textarea } from "./ui";

const LABELS: Record<string, string> = {
  name: "Client",
  contactName: "Contact",
  contactEmail: "Contact email",
  contactPhone: "Phone",
  billingEmail: "Billing email",
  billingReference: "Billing reference",
  address: "Address",
  notes: "Notes",
  tier: "Plan",
  maxSessions: "Casting calls included",
  maxRolesPerSession: "Roles per casting call",
  accessUntil: "Access until",
};

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

      <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
        <legend className="px-2 text-sm font-semibold tracking-tight">The company</legend>
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

      <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
        <legend className="px-2 text-sm font-semibold tracking-tight">Billing</legend>
        <p className="text-sm text-muted">
          Where invoices go, and whatever reference they need on them.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Billing email" htmlFor="billingEmail" error={errors.billingEmail}>
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              defaultValue={values.billingEmail ?? ""}
            />
          </Field>
          <Field
            label="Billing reference"
            htmlFor="billingReference"
            hint="A purchase order number, or whatever they quote."
            error={errors.billingReference}
          >
            <Input
              id="billingReference"
              name="billingReference"
              defaultValue={values.billingReference ?? ""}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
        <legend className="px-2 text-sm font-semibold tracking-tight">What they bought</legend>
        <p className="max-w-prose text-sm text-muted">
          Every account under this client inherits these. Leave a ceiling blank for no limit,
          and the date blank for no end.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
            <Input
              id="accessUntil"
              name="accessUntil"
              type="date"
              defaultValue={values.accessUntil ?? ""}
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : client ? "Save the client" : "Take on the client"}
        </Button>
        <ButtonLink href="/admin/clients" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
