"use client";

import { useEffect } from "react";

import { Button, ButtonLink, Eyebrow } from "@/components/ui";

/**
 * The last line before a hosting platform's own error page, which tells whoever
 * hit it nothing at all. This says what to try, and shows the digest, the id
 * the server log entry is filed under, which is the only way to match a report
 * to a log line.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-5 py-28">
      <Eyebrow>Something went wrong</Eyebrow>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
        This page did not load
      </h1>
      <p className="mt-3 max-w-prose text-muted">
        The error is on our side, not yours. Nothing you submitted has been lost. If you were
        part-way through a submission, open the casting link again and it will still be there.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-8 text-xs text-faint">
          Reference <code className="text-muted">{error.digest}</code>. Quote this if you report
          it.
        </p>
      ) : null}
    </div>
  );
}
