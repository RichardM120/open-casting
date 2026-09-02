import { permanentRedirect } from "next/navigation";

/**
 * The people applying are applicants now. This path was public and may be
 * linked from a mailout or a share, so it keeps working.
 */
export default function PerformersFaqPage() {
  permanentRedirect("/faq/applicants");
}
