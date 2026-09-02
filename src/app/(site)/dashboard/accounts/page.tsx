import { permanentRedirect } from "next/navigation";

/** Accounts moved to the admin section. Old links still land there. */
export default function DashboardAccountsPage() {
  permanentRedirect("/admin/accounts");
}
