"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button, Input, Select, cx } from "./ui";

/**
 * A date, or a date and time, with a picker that asks before it commits.
 *
 * The browser's own picker closes the moment a day is clicked, with nothing
 * to confirm and no way to change your mind. The field underneath here is
 * still the native one, so it can be typed into and filled by a test, but its
 * pop-up is hidden and the calendar button beside it opens this picker
 * instead: pick a day, set the time, and nothing reaches the field until
 * Confirm. Cancel, Escape and a click elsewhere leave it as it was.
 *
 * Weeks start on Monday, as UK calendars do. Values are whatever the native
 * field would hold: yyyy-mm-dd, or yyyy-mm-ddThh:mm, read as UK time by the
 * server exactly as before.
 */

type Mode = "date" | "datetime";
type Day = { year: number; month: number; day: number };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Day) => `${d.year}-${pad(d.month + 1)}-${pad(d.day)}`;
const fromDate = (date: Date): Day => ({
  year: date.getFullYear(),
  month: date.getMonth(),
  day: date.getDate(),
});
const sameDay = (a: Day | null, b: Day | null) =>
  a !== null && b !== null && a.year === b.year && a.month === b.month && a.day === b.day;
const shift = (d: Day, days: number) => fromDate(new Date(d.year, d.month, d.day + days));

/** What a field holds, as a day and a time, or nothing when it is empty or half typed. */
function parse(value: string): { day: Day | null; hour: number | null; minute: number | null } {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return { day: null, hour: null, minute: null };
  return {
    day: { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) },
    hour: match[4] ? Number(match[4]) : null,
    minute: match[5] ? Number(match[5]) : null,
  };
}

/** Six weeks of days around a month, Monday first, so the grid never jumps in height. */
function monthGrid(year: number, month: number): Day[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => fromDate(new Date(year, month, 1 - lead + i)));
}

export function DateTimeField({
  id,
  name,
  label,
  mode,
  defaultValue = "",
  defaultTime = "09:00",
  required,
  align = "start",
  onChange,
  ...aria
}: {
  id: string;
  name: string;
  /** The field's label, for the button and the dialog to name themselves by. */
  label: string;
  mode: Mode;
  defaultValue?: string;
  /** The time offered when the field is empty, hh:mm. */
  defaultTime?: string;
  required?: boolean;
  /** Which edge of the field the picker hangs from. "end" keeps a right-hand column on screen. */
  align?: "start" | "end";
  onChange?: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Day | null>(null);
  const [view, setView] = useState(() => {
    const today = fromDate(new Date());
    return { year: today.year, month: today.month };
  });
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const followFocus = useRef(false);
  const dialogId = useId();

  const what = mode === "date" ? "a date" : "a date and time";
  const today = fromDate(new Date());

  function commit(next: string) {
    setValue(next);
    onChange?.(next);
  }

  function focusDay(day: Day) {
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toKey(day)}"]`)?.focus();
  }

  function show() {
    const current = parse(value);
    const [defaultHour, defaultMinute] = defaultTime.split(":").map(Number);
    const base = current.day ?? today;
    setPicked(current.day);
    setHour(current.hour ?? defaultHour);
    setMinute(current.minute ?? defaultMinute);
    setView({ year: base.year, month: base.month });
    setOpen(true);
    // The grid exists only once the state above has rendered.
    requestAnimationFrame(() => focusDay(base));
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function choose(day: Day) {
    setPicked(day);
    setView({ year: day.year, month: day.month });
  }

  function confirm() {
    if (!picked) return;
    commit(mode === "date" ? toKey(picked) : `${toKey(picked)}T${pad(hour)}:${pad(minute)}`);
    close();
  }

  function clear() {
    commit("");
    close();
  }

  function now() {
    const moment = new Date();
    choose(fromDate(moment));
    setHour(moment.getHours());
    setMinute(moment.getMinutes());
  }

  function onGridKey(event: React.KeyboardEvent) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    followFocus.current = true;
    choose(shift(picked ?? today, step));
  }

  // The keyboard moves the selection; focus follows it once it has rendered.
  useEffect(() => {
    if (open && picked && followFocus.current) {
      followFocus.current = false;
      focusDay(picked);
    }
  }, [open, picked]);

  // A click elsewhere or Escape is a cancel: the field keeps what it had.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = monthGrid(view.year, view.month);
  const focusable = picked ?? today;
  const summary = picked
    ? `${DAY_LABEL.format(new Date(picked.year, picked.month, picked.day))}${
        mode === "datetime" ? ` at ${pad(hour)}:${pad(minute)}` : ""
      }`
    : "Pick a day";

  return (
    <div ref={wrapper} className="relative">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={name}
          type={mode === "date" ? "date" : "datetime-local"}
          value={value}
          onChange={(event) => commit(event.target.value)}
          required={required}
          className="date-field min-w-0 flex-1"
          {...aria}
        />
        <button
          ref={trigger}
          type="button"
          onClick={() => (open ? close() : show())}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          aria-label={`Pick ${what} for ${label}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-muted transition-colors hover:border-accent hover:text-brand"
        >
          <CalendarGlyph />
        </button>
      </div>

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`Pick ${what} for ${label}`}
          className={cx(
            "absolute top-full z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-line-strong bg-surface p-4 shadow-2xl shadow-black/15",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setView(previousMonth(view))}
              aria-label="Previous month"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-text"
            >
              <Chevron direction="left" />
            </button>
            <p className="text-sm font-medium" aria-live="polite">
              {MONTH_LABEL.format(new Date(view.year, view.month, 1))}
            </p>
            <button
              type="button"
              onClick={() => setView(nextMonth(view))}
              aria-label="Next month"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-text"
            >
              <Chevron direction="right" />
            </button>
          </div>

          <div ref={grid} className="mt-3 grid grid-cols-7 gap-1" onKeyDown={onGridKey}>
            {WEEKDAYS.map((weekday, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="py-1 text-center text-[11px] font-medium tracking-wide text-faint"
              >
                {weekday}
              </span>
            ))}
            {days.map((day) => {
              const selected = sameDay(day, picked);
              const inMonth = day.month === view.month;
              return (
                <button
                  key={toKey(day)}
                  type="button"
                  data-day={toKey(day)}
                  tabIndex={sameDay(day, focusable) ? 0 : -1}
                  aria-pressed={selected}
                  aria-label={DAY_LABEL.format(new Date(day.year, day.month, day.day))}
                  onClick={() => choose(day)}
                  className={cx(
                    "h-10 rounded-lg text-sm tabular-nums transition-colors",
                    selected
                      ? "bg-accent font-medium text-accent-ink"
                      : inMonth
                        ? "text-text hover:bg-raised"
                        : "text-faint hover:bg-raised",
                    !selected && sameDay(day, today) ? "ring-1 ring-accent/60" : "",
                  )}
                >
                  {day.day}
                </button>
              );
            })}
          </div>

          {mode === "datetime" ? (
            <div className="mt-4 flex items-center gap-2">
              <label htmlFor={`${id}-hour`} className="mr-1 text-xs font-medium text-muted">
                Time
              </label>
              <div className="w-24">
                <Select
                  id={`${id}-hour`}
                  aria-label="Hour"
                  value={pad(hour)}
                  onChange={(event) => setHour(Number(event.target.value))}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={pad(h)}>
                      {pad(h)}
                    </option>
                  ))}
                </Select>
              </div>
              <span aria-hidden="true" className="text-muted">
                :
              </span>
              <div className="w-24">
                <Select
                  id={`${id}-minute`}
                  aria-label="Minute"
                  value={pad(minute)}
                  onChange={(event) => setMinute(Number(event.target.value))}
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={pad(m)}>
                      {pad(m)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-muted" aria-live="polite">
            {summary}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={now}>
                {mode === "date" ? "Today" : "Now"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={confirm} disabled={!picked}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function previousMonth(view: { year: number; month: number }) {
  return view.month === 0 ? { year: view.year - 1, month: 11 } : { ...view, month: view.month - 1 };
}

function nextMonth(view: { year: number; month: number }) {
  return view.month === 11 ? { year: view.year + 1, month: 0 } : { ...view, month: view.month + 1 };
}

function CalendarGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "left" ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
    </svg>
  );
}
