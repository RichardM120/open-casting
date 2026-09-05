"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isAdminPath } from "@/lib/admin-nav";

import { cx } from "./ui";

/**
 * The column the header, the page and the footer sit in, and the one place
 * that decides which palette they are drawn in.
 *
 * Front of house is warm — cream ground, terracotta bar, gold action. The
 * administrator's section is cool: slate paper, a petrol bar, teal action.
 * The swap is a class that redefines the colour tokens (see `globals.css`),
 * so it reaches every component inside without any of them knowing, and the
 * ground is painted here rather than on the body, which cannot know where
 * the reader is.
 *
 * Which section you are in is the path, not the role: an administrator doing
 * their own casting is front of house and gets the warm palette, exactly as
 * they get the casting navigation.
 */
export function SectionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className={cx("flex flex-1 flex-col bg-ink", isAdminPath(pathname) && "section-admin")}
      data-section={isAdminPath(pathname) ? "admin" : "casting"}
    >
      {children}
    </div>
  );
}
