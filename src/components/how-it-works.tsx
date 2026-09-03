"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ButtonLink, Eyebrow, cx } from "./ui";

/**
 * The five moves from a brief to a shortlist, each with a line drawing. From a
 * wide screen up they stand in a row of five cards with a closing note. On a
 * phone they are a carousel: one card in view with the next peeking, swiped
 * through to a last slide that is the way in: the sign-up button. The drawings share one grid,
 * one stroke and one accent, so the row reads as a set.
 */
const STEPS: { key: StepKey; title: string; body: string }[] = [
  {
    key: "setup",
    title: "Set up the casting call",
    body: "Name it, set the casting window and add the synopsis. It holds the dates for every role.",
  },
  {
    key: "roles",
    title: "Post the roles",
    body: "One for each part: the brief, playing age, pay and shoot dates. They open and close with the call.",
  },
  {
    key: "publish",
    title: "Publish",
    body: "Check it over and publish. Until then nobody but you can see it.",
  },
  {
    key: "share",
    title: "Share the link",
    body: "One private link for the whole casting call. Post it wherever your applicants are.",
  },
  {
    key: "read",
    title: "Read what comes in",
    body: "Every submission in one list, newest first. Shortlist, call back, decline, and export.",
  },
];

type StepKey = "setup" | "roles" | "publish" | "share" | "read";

/** The step cards plus, on a phone, the closing slide. */
const SLIDES = STEPS.length + 1;

export function HowItWorks() {
  const track = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);

  // Which slide is nearest the middle of the track: read on scroll, once per
  // frame, so the dots follow a swipe without work on every scroll event.
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const slides = Array.from(element.children) as HTMLElement[];
      const middle = element.scrollLeft + element.clientWidth / 2;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      slides.forEach((slide, i) => {
        const gap = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
        if (gap < distance) {
          distance = gap;
          nearest = i;
        }
      });
      setIndex(nearest);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const go = useCallback((to: number) => {
    const slide = track.current?.children[Math.max(0, Math.min(SLIDES - 1, to))] as
      | HTMLElement
      | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, []);

  // Each card is a positioning context: the hidden "Step n" prefix in its
  // heading is absolutely positioned, and without this it would hang off the
  // page beside the card and widen the page by the carousel's length.
  const card =
    "relative flex shrink-0 snap-center flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card lg:shrink lg:snap-align-none";

  return (
    <section aria-labelledby="how-it-works">
      <Eyebrow>How it works</Eyebrow>
      <h1 id="how-it-works" className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Five steps from a brief to a shortlist.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        There is nothing to browse and nothing to register for. A casting director sets a call up
        once; applicants open one link.
      </p>

      {/*
        On a phone the list scrolls sideways and snaps a card to the middle,
        with the page's own padding pulled in so the next card peeks at the
        edge. From a wide screen up the same list is a grid and none of the
        scrolling applies.
      */}
      <ol
        ref={track}
        aria-label="The five steps, and the way in"
        className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {STEPS.map((step, i) => (
          <li key={step.key} className={cx(card, "w-[84%]")}>
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink"
            >
              {i + 1}
            </span>
            <div className="flex h-28 items-center justify-center rounded-xl bg-raised">
              <StepArt step={step.key} />
            </div>
            <h3 className="text-base font-semibold tracking-tight">
              <span className="sr-only">Step {i + 1}: </span>
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
        <li className={cx(card, "w-[84%] justify-between bg-raised lg:hidden")}>
          <div className="flex flex-col gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-ink"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
            </span>
            <h3 className="text-lg font-semibold tracking-tight">Ready when you are.</h3>
            <p className="text-sm leading-relaxed text-muted">
              Everything applicants send is deleted 30 days after the production finishes. The
              casting call and its roles are kept, so the record of what you ran stays with you.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              One sign-in for everyone on the casting side. What you can see follows from your
              account, not from which door you came through.
            </p>
          </div>
          <ButtonLink href="/login" variant="signup" className="self-start">
            Sign up
          </ButtonLink>
        </li>
      </ol>

      {/* Where you are in the carousel, and a way through it without a swipe. */}
      <div className="mt-4 flex items-center justify-between gap-4 lg:hidden">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-raised text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Chevron direction="left" />
        </button>
        <div className="flex items-center gap-2" aria-label="Position">
          {Array.from({ length: SLIDES }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={i < STEPS.length ? `Step ${i + 1}` : "Sign up"}
              aria-current={index === i ? "true" : undefined}
              className="flex size-6 items-center justify-center rounded-full"
            >
              <span
                className={cx(
                  "block rounded-full transition-all",
                  index === i ? "h-2 w-5 bg-accent" : "size-2 bg-line-strong",
                )}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === SLIDES - 1}
          aria-label="Next"
          className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-raised text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Chevron direction="right" />
        </button>
      </div>

      <div className="mt-8 hidden flex-col gap-4 rounded-2xl border border-line bg-raised p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6 lg:flex">
        <div className="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-muted">
          <p>
            Everything applicants send is deleted 30 days after the production finishes. The
            casting call and its roles are kept, so the record of what you ran stays with you.
          </p>
          <p>
            One sign-in for everyone on the casting side. What you can see follows from your
            account, not from which door you came through: an administrator lands on every casting
            call on the system, a casting director on their own.
          </p>
        </div>
        <ButtonLink href="/login" variant="signup" size="lg" className="shrink-0 self-start sm:self-auto">
          Sign up
        </ButtonLink>
      </div>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "left" ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
    </svg>
  );
}

/**
 * One drawing per step on a 96 grid: 2.5px charcoal strokes, cream and white
 * fills, one terracotta accent each, and gold only for the light through the
 * published door and the tick on a read submission.
 */
function StepArt({ step }: { step: StepKey }) {
  const art: Record<StepKey, ReactNode> = {
    setup: (
      <>
        <path d="M26 12h30l14 14v54a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" />
        <path d="M56 12v14h14" />
        <path d="M32 38h22M32 48h30M32 58h18" />
        <rect x="52" y="58" width="30" height="26" rx="5" className="fill-raised" />
        <path d="M52 67h30" className="stroke-brand" />
        <path d="M60 55v6M74 55v6" />
        <circle cx="67" cy="76" r="2.75" className="fill-brand" stroke="none" />
      </>
    ),
    roles: (
      <>
        <rect x="12" y="24" width="44" height="58" rx="6" className="fill-raised" />
        <rect x="26" y="18" width="44" height="58" rx="6" className="fill-raised" />
        <rect x="40" y="12" width="44" height="58" rx="6" className="fill-surface" />
        <circle cx="62" cy="34" r="8" />
        <path d="M48 58c2-8 8-12 14-12s12 4 14 12" />
        <path d="M50 64h24" className="stroke-brand" />
      </>
    ),
    publish: (
      <>
        <g transform="translate(10 16)">
          <path d="M7 7h12v6.5h-5.5v37H19V57H7z" />
          <path d="M57 7H45v6.5h5.5v37H45V57h12z" />
          <path d="M23.5 15.5 39.5 11.5V52.5L23.5 48.5Z" className="fill-raised" />
          <circle cx="36.8" cy="32" r="2.5" className="fill-accent" stroke="none" />
        </g>
        <path d="M74 22l8-6M76 40h10M74 58l8 6" className="stroke-accent" />
      </>
    ),
    share: (
      <>
        <path d="M40 60l16-16" />
        <path d="M52 30l7-7a11 11 0 0 1 15.5 15.5l-7 7" />
        <path d="M44 66l-7 7A11 11 0 0 1 21.5 57.5l7-7" />
        <path d="M62 78h18M74 72l6 6-6 6" className="stroke-brand" />
      </>
    ),
    read: (
      <>
        <rect x="14" y="30" width="60" height="50" rx="6" className="fill-raised" />
        <rect x="22" y="20" width="60" height="50" rx="6" className="fill-surface" />
        <circle cx="40" cy="38" r="7" />
        <path d="M28 58c2-7 7-10 12-10s10 3 12 10" />
        <path d="M58 36h16M58 44h12" />
        <circle cx="74" cy="66" r="11" className="fill-accent" stroke="none" />
        <path d="M68.5 66l4 4 7-8" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 96"
      className="size-24 stroke-text"
      fill="none"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {art[step]}
    </svg>
  );
}
