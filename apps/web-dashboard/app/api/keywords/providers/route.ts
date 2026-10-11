import { NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/keywords/provider-status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getProviderStatuses(), { headers: { "cache-control": "private, no-store" } });
}
