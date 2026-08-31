import { ButtonLink, Eyebrow } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-5 py-28">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
        That page is not here
      </h1>
      <p className="mt-3 text-muted">
        The role may have been taken down, or the link may have been mistyped.
      </p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/roles">Browse open roles</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    </div>
  );
}
