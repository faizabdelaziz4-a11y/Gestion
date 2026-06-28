import { NextRequest } from "next/server";
import { json, requireOwner, isResponse } from "@/lib/api";
import { compute, Statut } from "@/lib/payroll";
import { getNumberSetting } from "@/lib/db";

export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const sp = req.nextUrl.searchParams;
  const amount = Number(sp.get("amount")) || 0;
  const statut = (sp.get("statut") || "employe") as Statut;
  const basis = (sp.get("basis") || "net") as "net" | "brut";

  const breakdown = compute(amount, statut, basis, {
    onssWorkerRate: getNumberSetting("onss_worker_rate", 0.1307),
    onssStudentRate: getNumberSetting("onss_student_rate", 0.0271),
    employerOnssRate: getNumberSetting("employer_onss_rate", 0.25),
  });
  return json({ breakdown });
}
