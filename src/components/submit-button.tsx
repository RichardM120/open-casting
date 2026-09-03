"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "./ui";

/**
 * The call to action at the foot of a form. It stays quiet, drawn as a
 * secondary button, until every required field is filled in, and only then
 * takes the primary colour: the colour says "ready", not "press me and find
 * out what is missing". It is never disabled for that, so a press still shows
 * the browser's own message on the first empty field.
 *
 * Required fields are read from the form itself. A control marked `data-must`
 * counts too: the terms checkboxes, which the server checks rather than the
 * browser, so a refusal can say more than "tick this".
 */
export function SubmitButton({
  disabled,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type" | "variant">) {
  const { pending } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);

  // Read after every render, not only on input: a section that appears once
  // an age is chosen brings required fields with it and fires no event.
  useEffect(() => {
    const form = button.current?.form;
    if (!form) return;
    const read = () => setReady(complete(form));
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  });

  return (
    <Button
      {...props}
      ref={button}
      type="submit"
      variant={ready ? "primary" : "secondary"}
      data-ready={ready ? "true" : "false"}
      disabled={disabled || pending}
    >
      {children}
    </Button>
  );
}

function complete(form: HTMLFormElement): boolean {
  if (!form.checkValidity()) return false;
  for (const control of form.querySelectorAll<HTMLInputElement>("[data-must]")) {
    if (control.type === "checkbox" ? !control.checked : !control.value.trim()) return false;
  }
  return true;
}
