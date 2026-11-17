import { NextResponse } from "next/server";
import { getDailyBrief } from "@/lib/daily-brief";

export async function GET() {
  return NextResponse.json(await getDailyBrief());
}
