import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "../components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/espace");
  return <Shell>{children}</Shell>;
}
