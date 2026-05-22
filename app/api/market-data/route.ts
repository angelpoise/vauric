import { NextResponse } from "next/server";

export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
  streak: number;
  streakDirection: "up" | "down" | "flat";
}

export async function GET() {
  return NextResponse.json({});
}
