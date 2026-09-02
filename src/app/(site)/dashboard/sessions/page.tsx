import { permanentRedirect } from "next/navigation";

/** The casting calls list is the dashboard itself now. Old links still land there. */
export default function SessionsPage() {
  permanentRedirect("/dashboard");
}
