import { NextResponse } from "next/server";

export interface RSEntry {
  ticker: string;
  etf: string;
  vs1w: number | null;
  vs1m: number | null;
  vs3m: number | null;
  score: number;
  trend: "outperforming" | "inline" | "underperforming";
}

export async function GET() {
  return NextResponse.json(null);
}
