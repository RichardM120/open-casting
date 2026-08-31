"use client";

import { useEffect, useRef } from "react";

/**
 * Moves focus to the first field a server action rejected, so the person is
 * taken to the problem rather than left at the bottom of the form wondering
 * what happened. Prefers the summary when there is one, since that lists
 * everything at once.
 */
export function useErrorFocus(status: string, errors: Record<string, string>) {
  const form = useRef<HTMLFormElement>(null);
  const signature = `${status}:${Object.keys(errors).sort().join(",")}`;
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "error" || lastHandled.current === signature) return;
    lastHandled.current = signature;

    const summary = form.current?.querySelector<HTMLElement>("[data-error-summary]");
    const target =
      summary ?? form.current?.querySelector<HTMLElement>("[aria-invalid='true']");

    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [status, signature]);

  return form;
}
