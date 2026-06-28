import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import Shell from "../components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/espace");
  const business = getSetting("business_name", "Mon Commerce");
  return <Shell business={business}>{children}</Shell>;
}
