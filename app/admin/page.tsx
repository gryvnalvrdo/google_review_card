import { redirect } from "next/navigation";
import { isAdminLoggedIn } from "../../lib/auth";
import AdminDashboard from "./dashboard-client";

export default async function AdminPage() {
  const loggedIn = await isAdminLoggedIn();
  if (!loggedIn) {
    redirect("/admin/login");
  }
  return <AdminDashboard />;
}
