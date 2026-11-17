import { redirect } from "next/navigation";
import { isAdminLoggedIn } from "../../../lib/auth";
import AdminNav from "../components/AdminNav";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = await isAdminLoggedIn();
  if (!loggedIn) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-6">
        {children}
      </main>
    </div>
  );
}
