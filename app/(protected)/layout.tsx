import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureSuperAdminExists } from "@/lib/ensureSuperAdmin";
import AppNav from "@/components/AppNav";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const hasSuperAdmin = await ensureSuperAdminExists();
  if (!hasSuperAdmin) {
    redirect("/setup");
  }

  const sessionInfo = session
    ? {
        email: session.user?.email ?? "",
        role: session.user?.role ?? "",
        tenantId: session.user?.tenantId ?? null,
      }
    : null;

  return (
    <>
      <AppNav session={sessionInfo} />
      <div className="pt-16">{children}</div>
    </>
  );
}
