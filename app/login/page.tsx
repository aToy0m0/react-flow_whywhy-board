import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import LoginClient from "./LoginClient";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }

  return <LoginClient callbackUrl="/" />;
}
