import { NextRequest } from "next/server";
import { json, requireOwnerBusiness, isResponse } from "@/lib/api";
import { summary } from "@/lib/finance";
import { isoDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const biz = await requireOwnerBusiness();
  if (isResponse(biz)) return biz;
  const sp = req.nextUrl.searchParams;
  const period = (sp.get("period") as "day" | "week" | "month") || "month";
  const date = sp.get("date") || isoDate(new Date());
  return json(summary(biz.id, period, date));
}
