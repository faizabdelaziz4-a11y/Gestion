import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import EspaceClient from "./EspaceClient";

export default async function EspacePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "owner") redirect("/");
  return <EspaceClient name={session.name} />;
}
