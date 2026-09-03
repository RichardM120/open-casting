"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "./ui";

/**
 * A submit that asks first. The button opens a small dialog that says what is
 * about to happen; the dialog's own confirm button is the real submit, inside
 * the same form, so nothing is sent until it is pressed. Escape, Cancel or a
 * click outside close it and put focus back on the button that opened it.
 */
export function ConfirmSubmit({
  label,
  title,
  body,
  confirmLabel,
  disabled,
  variant = "primary",
  size,
}: {
  label: string;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  disabled?: boolean;
  variant?: "primary" | "danger";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) confirm.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => opener.current?.focus());
  }

  // Focus stays inside the dialog: Tab from the last button wraps to the
  // first, and Shift+Tab the other way.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const buttons = Array.from(dialog.current.querySelectorAll<HTMLButtonElement>("button"));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <Button
        ref={opener}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {label}
      </Button>
      {open ? (
        <>
          <div aria-hidden="true" onMouseDown={close} className="fixed inset-0 z-40 bg-black/30" />
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-body`}
            onKeyDown={onKeyDown}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/15"
          >
            <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <div id={`${id}-body`} className="mt-3 text-sm leading-relaxed text-muted">
              {body}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button ref={confirm} type="submit" variant={variant}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
