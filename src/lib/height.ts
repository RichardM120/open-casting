/**
 * A height as people type it, in either system, kept in centimetres.
 *
 * "172", "172 cm", "1.72 m", "5'8", "5ft 8in", "5 foot 8" and "5' 8\"" all
 * come out the same. Anything outside the range a person can be is refused,
 * as are the shapes that cannot be read at all.
 */
export function parseHeight(value: string): number | null {
  const text = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  let cm: number | null = null;
  const metric = text.match(/^(\d+(?:[.,]\d+)?) ?(cm|centimetres?|m|metres?)?$/);
  const imperial = text.match(
    /^(\d{1,2}) ?(?:'|′|ft\.?|feet|foot) ?(?:(\d{1,2}(?:[.,]\d+)?) ?(?:"|″|''|in\.?|inches|inch)?)?$/,
  );
  if (metric) {
    const number = Number(metric[1].replace(",", "."));
    const unit = metric[2] ?? "";
    cm = unit.startsWith("m") && !unit.startsWith("mm") ? number * 100 : number;
    // A bare "1.72" is metres; a bare "172" is centimetres.
    if (!unit && number < 3) cm = number * 100;
  } else if (imperial) {
    const feet = Number(imperial[1]);
    const inches = imperial[2] ? Number(imperial[2].replace(",", ".")) : 0;
    if (inches >= 12) return null;
    cm = feet * 30.48 + inches * 2.54;
  }
  if (cm === null || !Number.isFinite(cm)) return null;
  const rounded = Math.round(cm);
  return rounded >= 50 && rounded <= 272 ? rounded : null;
}

/** "173 cm (5ft 8)": both ways round, since casting reads both. */
export function formatHeight(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${cm} cm (${feet}ft ${inches})`;
}
