import { SessionInfo } from '@/types/session';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClientLayout from './ClientLayout';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const sessionInfo: SessionInfo = {
    email: session.user?.email ?? "",
    role: session.user?.role ?? "",
    tenantId: session.user?.tenantId ?? null,
  };

  return (
    <ClientLayout sessionInfo={sessionInfo}>{children}</ClientLayout>
  );
}

// import { ReactNode } from "react";
// import { redirect } from "next/navigation";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { ensureSuperAdminExists } from "@/lib/ensureSuperAdmin";

// // import AppNav from "@/components/AppNav";
// import AppNavWrapper from '@/components/AppNavWrapper';

// type ProtectedLayoutProps = {
//   children: ReactNode;
// };

// export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
//   const session = await getServerSession(authOptions);
//   if (!session) {
//     redirect("/login");
//   }

//   const hasSuperAdmin = await ensureSuperAdminExists();
//   if (!hasSuperAdmin) {
//     redirect("/setup");
//   }

//   const sessionInfo = session
//     ? {
//         email: session.user?.email ?? "",
//         role: session.user?.role ?? "",
//         tenantId: session.user?.tenantId ?? null,
//       }
//     : null;

//   return (
//     <>
//       <AppNavWrapper session={sessionInfo} />
//       <div className="pt-
//       ">{children}</div>
//     </>
//   );
// }
