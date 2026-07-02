import { NextRequest } from "next/server";
import { json, requireOwnerBusiness, isResponse } from "@/lib/api";
import { compute, Statut } from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const sp = req.nextUrl.searchParams;
  const amount = Number(sp.get("amount")) || 0;
  const statut = (sp.get("statut") || "employe") as Statut;
  const basis = (sp.get("basis") || "net") as "net" | "brut";

  const breakdown = compute(amount, statut, basis, {
    onssWorkerRate: biz.onss_worker_rate,
    onssStudentRate: biz.onss_student_rate,
    employerOnssRate: biz.employer_onss_rate,
  });
  return json({ breakdown });
}
