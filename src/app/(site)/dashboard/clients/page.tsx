import { permanentRedirect } from "next/navigation";

/** Clients moved to the admin section. Old links still land there. */
export default function DashboardClientsPage() {
  permanentRedirect("/admin/clients");
}
