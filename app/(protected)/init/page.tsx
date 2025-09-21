import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import InitClient from "./ui";
import { authOptions } from "@/lib/auth";

export default async function InitPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }
  return <InitClient email={session.user.email ?? null} />;
}
