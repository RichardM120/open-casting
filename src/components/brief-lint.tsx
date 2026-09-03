"use client";

import { useEffect, useRef, useState } from "react";

import { involvesMinors, lintBrief, type BriefWarning } from "@/lib/brief-lint";

/**
 * Sits inside the role form and reads it as it is typed: the playing age,
 * the character brief, the requirements and every video brief. For a role
 * cast to children it warns where a brief asks for something that should
 * stay a field rather than go on tape. The warnings stand while the director
 * decides; a role posted with them still up is recorded as such.
 */
export function BriefLint() {
  const holder = useRef<HTMLDivElement>(null);
  const [warnings, setWarnings] = useState<BriefWarning[]>([]);

  // Listens once, from mount; the form's own input events drive the rest.
  // State is replaced only when the set of warnings changes, so a render
  // never triggers another.
  useEffect(() => {
    const form = holder.current?.closest("form");
    if (!form) return;
    const read = () => {
      const ageMin = (form.elements.namedItem("ageMin") as HTMLInputElement | null)?.value ?? "";
      const text = involvesMinors(ageMin)
        ? Array.from(
            form.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
              '#characterBrief, #requirements, textarea[name^="slot_"][name$="_brief"], input[name^="slot_"][name$="_label"]',
            ),
          )
            .map((field) => field.value)
            .join("\n")
        : "";
      const next = text ? lintBrief(text) : [];
      setWarnings((current) =>
        current.length === next.length && current.every((warning, index) => warning.key === next[index].key)
          ? current
          : next,
      );
    };
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, []);

  return (
    <div ref={holder}>
      <input type="hidden" name="briefWarnings" value={warnings.map((warning) => warning.key).join(",")} />
      {warnings.length > 0 ? (
        <aside
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-amber/40 bg-amber-soft p-4 sm:p-6"
        >
          <p className="text-sm font-semibold text-amber">
            This role is cast to children, and the brief asks for something better kept off a tape
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {warnings.map((warning) => (
              <li key={warning.key} data-brief-warning={warning.key} className="text-sm leading-relaxed">
                <span className="font-medium text-text">It asks about {warning.label}.</span>{" "}
                <span className="text-muted">{warning.hint}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            You can post it as it is: this is advice, and the role is recorded as posted with these
            warnings. Or change the brief and they go.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
