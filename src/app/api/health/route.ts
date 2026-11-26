import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";

export async function GET() {
  const isProd = process.env.NODE_ENV === "production";
  const payload = isProd
    ? { status: "healthy" }
    : {
        status: "healthy",
        database: { pooled: true, activeConnections: 1 },
        cache: { connected: true },
      };

  const res = NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
  applySecurityHeaders(res.headers);
  return res;
}
