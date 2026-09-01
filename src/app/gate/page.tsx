import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GateForm } from "@/components/gate-form";
import { Eyebrow } from "@/components/ui";
import { gateEnabled } from "@/lib/gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Casting",
  robots: { index: false, follow: false },
};

export default async function GatePage({ searchParams }: PageProps<"/gate">) {
  // Once the passcode is removed the gate is gone, and this page with it.
  if (!gateEnabled()) redirect("/");

  const params = await searchParams;
  const next = typeof params.next === "string" && /^\/(?!\/)/.test(params.next) ? params.next : "/";

  return (
    <div className="mx-auto max-w-md px-5 py-24">
      <Eyebrow>Not open yet</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Open Casting</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        This is being built and is not open to the public. If you have been given a passcode,
        enter it below.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-7">
        <GateForm next={next} />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-faint">
        If you were sent a casting link and it brought you here, the production is not accepting
        submissions yet. Keep the link — it will work when they open.
      </p>
    </div>
  );
}
