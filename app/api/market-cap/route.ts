import { NextResponse } from "next/server";

export interface MarketCapEntry {
  marketCap: number;
}

export async function GET() {
  return NextResponse.json({});
}
