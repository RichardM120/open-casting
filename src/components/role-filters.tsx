"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { PAY_TYPES, PRODUCTION_TYPES, UNION_STATUSES } from "@/lib/types";

import { Checkbox, Input, Select, cx } from "./ui";

const DEBOUNCE_MS = 300;

export function RoleFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const activeQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(activeQuery);
  const [syncedQuery, setSyncedQuery] = useState(activeQuery);

  // Keep the box in step when the URL changes from elsewhere, such as the back
  // button. Adjusting during render rather than in an effect avoids a second pass.
  if (activeQuery !== syncedQuery) {
    setSyncedQuery(activeQuery);
    setQuery(activeQuery);
  }

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `/roles?${qs}` : "/roles", { scroll: false }));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  useEffect(() => {
    if (query === activeQuery) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (query) next.set("q", query);
      else next.delete("q");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `/roles?${qs}` : "/roles", { scroll: false }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `searchParams` is a stable snapshot for a given URL, so this re-runs only
    // when the typed query or the URL itself changes.
  }, [query, activeQuery, router, searchParams]);

  const filtered = [...searchParams.keys()].length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="lg:col-span-2">
          <span className="sr-only">Search roles</span>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search role, production, location…"
          />
        </label>

        <FilterSelect
          label="Production type"
          value={searchParams.get("type") ?? ""}
          options={PRODUCTION_TYPES}
          onChange={(value) => setParam("type", value)}
        />
        <FilterSelect
          label="Union status"
          value={searchParams.get("union") ?? ""}
          options={UNION_STATUSES}
          onChange={(value) => setParam("union", value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterSelect
          label="Pay"
          value={searchParams.get("pay") ?? ""}
          options={PAY_TYPES}
          onChange={(value) => setParam("pay", value)}
          className="w-44"
        />
        <Checkbox
          label="Self-tape accepted"
          checked={searchParams.get("selftape") === "1"}
          onChange={(event) => setParam("selftape", event.target.checked ? "1" : "")}
        />
        <Checkbox
          label="Include closed roles"
          checked={searchParams.get("closed") === "1"}
          onChange={(event) => setParam("closed", event.target.checked ? "1" : "")}
        />

        <p
          className={cx(
            "ml-auto text-sm transition-opacity",
            pending ? "text-faint opacity-60" : "text-muted",
          )}
          aria-live="polite"
        >
          {resultCount} {resultCount === 1 ? "role" : "roles"}
          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                push(new URLSearchParams());
              }}
              className="ml-3 text-accent underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}: any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </label>
  );
}
