import { NextRequest } from "next/server";
import { json, requireOwner, isResponse } from "@/lib/api";
import { summary } from "@/lib/finance";
import { isoDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (isResponse(guard)) return guard;
  const sp = req.nextUrl.searchParams;
  const period = (sp.get("period") as "day" | "week" | "month") || "month";
  const date = sp.get("date") || isoDate(new Date());
  return json(summary(period, date));
}
