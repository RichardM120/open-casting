"use client";

import { useState } from "react";

import { Button } from "./ui";

/**
 * The link a production hands to performers. It is the only way in to a casting
 * call, so it is shown in full, selectable, and copyable in one action — a
 * half-copied token is the most likely way for someone to be locked out.
 */
export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen and selectable.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-xs break-all select-all">
        {url}
      </code>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
